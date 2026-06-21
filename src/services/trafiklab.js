import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { routeTypeToMode } from './modes';
import { TRAFIKLAB_FEED_BASE, TRIP_MAPPING_URL } from '../config/endpoints.js';

// Cache for trip mapping (tripId → { line, routeType })
let tripMappingCache = undefined; // undefined = not loaded, null = unavailable

export function resetTripMappingCache() {
  tripMappingCache = undefined;
}

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

function buildVehicleUrl(slug, apiKey) {
  return `${TRAFIKLAB_FEED_BASE}/${encodeURIComponent(slug)}/VehiclePositionsSweden.pb?key=${apiKey}`;
}

/**
 * Fetch and parse GTFS-RT vehicle positions for a single operator.
 * Returns the vehicles plus the feed-level data timestamp (used by the
 * feed-outage frozen-timestamps rule to tell a live feed from a dead one).
 * @returns {Promise<{ vehicles: object[], dataTimestamp: number|null }>}
 */
async function fetchSingleOperator(slug, tripMapping, apiKey) {
  const response = await fetch(buildVehicleUrl(slug, apiKey), {
    headers: { 'Accept-Encoding': 'gzip' }
  });

  if (!response.ok) {
    throw new Error(`API request failed for ${slug}: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buffer);
  const timestamp = feed.header.timestamp;
  const dataTimestamp = timestamp != null ? Number(timestamp) : null;

  const vehicles = [];
  for (const entity of feed.entity) {
    if (!entity.vehicle || !entity.vehicle.position) continue;
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

    const vehicle = {
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
    if (vehicle.latitude && vehicle.longitude) {
      vehicles.push(vehicle);
    }
  }

  return { vehicles, dataTimestamp };
}

/**
 * Fetch GTFS-RT vehicle positions for one or more operators AND the per-operator
 * fetch outcomes. The outcomes feed the command-center feed-outage rules; they
 * are recorded from the polling that already happens — no extra feed calls, so
 * the rate-limit budget is unchanged.
 *
 * Each outcome: { operator, ok, vehicleCount, dataTimestamp }. A failed fetch
 * (per-operator failures are tolerated via Promise.allSettled) yields
 * { ok: false, vehicleCount: 0, dataTimestamp: null }.
 *
 * @param {string[]} operatorSlugs
 * @param {{ apiKey?: string, getTripMapping?: () => Promise<object|null> }} [opts]
 * @returns {Promise<{ vehicles: object[], outcomes: object[] }>}
 */
export async function fetchOperatorFeeds(
  operatorSlugs = ['sl'],
  { apiKey = import.meta.env.VITE_TRAFIKLAB_API_KEY, getTripMapping = loadTripMapping } = {}
) {
  const tripMapping = await getTripMapping();

  const results = await Promise.allSettled(
    operatorSlugs.map(slug => fetchSingleOperator(slug, tripMapping, apiKey))
  );

  const vehicles = [];
  const outcomes = [];
  for (let i = 0; i < results.length; i++) {
    const slug = operatorSlugs[i];
    const result = results[i];
    if (result.status === 'fulfilled') {
      vehicles.push(...result.value.vehicles);
      outcomes.push({
        operator: slug,
        ok: true,
        vehicleCount: result.value.vehicles.length,
        dataTimestamp: result.value.dataTimestamp,
      });
    } else {
      console.warn(`Failed to fetch operator ${slug}:`, result.reason);
      outcomes.push({ operator: slug, ok: false, vehicleCount: 0, dataTimestamp: null });
    }
  }

  return { vehicles, outcomes };
}

/**
 * Fetch and parse GTFS-RT vehicle positions for one or more operators.
 * Back-compatible thin wrapper over {@link fetchOperatorFeeds} that returns just
 * the flattened vehicle list.
 * @param {string[]} operatorSlugs
 * @param {{ apiKey?: string, getTripMapping?: () => Promise<object|null> }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchVehiclePositions(operatorSlugs = ['sl'], opts = {}) {
  const { vehicles } = await fetchOperatorFeeds(operatorSlugs, opts);
  return vehicles;
}
