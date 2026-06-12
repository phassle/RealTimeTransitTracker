import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { routeTypeToMode } from './modes';
import { TRAFIKLAB_FEED_BASE, TRIP_MAPPING_URL } from '../config/endpoints.js';

const API_KEY = import.meta.env.VITE_TRAFIKLAB_API_KEY;

// Cache for trip mapping (tripId → { line, routeType })
let tripMappingCache = undefined; // undefined = not loaded, null = unavailable

/**
 * Load trip-mapping.json (built by scripts/build-trip-mapping.js).
 * Returns the mapping object or null if unavailable.
 */
async function loadTripMapping() {
  if (tripMappingCache !== undefined) return tripMappingCache;

  try {
    const response = await fetch(TRIP_MAPPING_URL);
    if (!response.ok) {
      tripMappingCache = null;
      return null;
    }
    tripMappingCache = await response.json();
    console.log(`Loaded trip mapping with ${Object.keys(tripMappingCache).length} entries`);
    return tripMappingCache;
  } catch {
    tripMappingCache = null;
    return null;
  }
}

function buildVehicleUrl(slug) {
  return `${TRAFIKLAB_FEED_BASE}/${encodeURIComponent(slug)}/VehiclePositionsSweden.pb?key=${API_KEY}`;
}

/**
 * Fetch and parse GTFS-RT vehicle positions for a single operator.
 */
async function fetchSingleOperator(slug, tripMapping) {
  const response = await fetch(buildVehicleUrl(slug), {
    headers: { 'Accept-Encoding': 'gzip' }
  });

  if (!response.ok) {
    throw new Error(`API request failed for ${slug}: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buffer);
  const timestamp = feed.header.timestamp;

  return feed.entity
    .filter(entity => entity.vehicle && entity.vehicle.position)
    .map(entity => {
      const v = entity.vehicle;
      const routeId = v.trip?.routeId;
      const tripId = v.trip?.tripId;

      let mode = 'unknown';
      let line = v.vehicle?.label || routeId || 'Unknown';

      if (tripId && tripMapping) {
        const tripInfo = tripMapping[tripId];
        if (tripInfo) {
          if (tripInfo.line) line = tripInfo.line;
          mode = routeTypeToMode(tripInfo.routeType);
        }
      }

      return {
        id: `${slug}:${v.vehicle?.id || entity.id}`,
        operator: slug,
        routeId,
        line,
        lineName: '',
        mode,
        latitude: v.position.latitude,
        longitude: v.position.longitude,
        bearing: v.position.bearing || 0,
        speed: v.position.speed || 0,
        timestamp: v.timestamp || timestamp,
        tripId,
        direction: v.trip?.directionId
      };
    })
    .filter(v => v.latitude && v.longitude);
}

/**
 * Fetch and parse GTFS-RT vehicle positions for one or more operators.
 * @param {string[]} operatorSlugs
 */
export async function fetchVehiclePositions(operatorSlugs = ['sl']) {
  const tripMapping = await loadTripMapping();

  const results = await Promise.allSettled(
    operatorSlugs.map(slug => fetchSingleOperator(slug, tripMapping))
  );

  const vehicles = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      vehicles.push(...result.value);
    } else {
      console.warn(`Failed to fetch operator ${operatorSlugs[i]}:`, result.reason);
    }
  }

  return vehicles;
}
