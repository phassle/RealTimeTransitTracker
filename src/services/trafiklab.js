import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

const API_KEY = import.meta.env.VITE_TRAFIKLAB_API_KEY;
const API_URL = `https://opendata.samtrafiken.se/gtfs-rt-sweden/sl/VehiclePositionsSweden.pb?key=${API_KEY}`;

// Cache for SL line data
let linesCache = null;
// Reverse lookup: designation (e.g. "1", "172") → mode
let designationModeCache = null;
// Cache for trip mapping (tripId → { line, routeType })
let tripMappingCache = undefined; // undefined = not loaded, null = unavailable

const GTFS_ROUTE_TYPE_TO_MODE = {
  '0': 'tram',      // Tram, Streetcar, Light rail
  '1': 'metro',     // Subway, Metro
  '2': 'train',     // Rail
  '3': 'bus',       // Bus
  '4': 'ferry',     // Ferry
  '5': 'tram',      // Cable tram
  '6': 'tram',      // Aerial lift
  '7': 'tram',      // Funicular
  '100': 'train',   // Railway Service
  '101': 'train',   // High Speed Rail
  '102': 'train',   // Long Distance Trains
  '109': 'train',   // Suburban Railway
  '400': 'metro',   // Urban Railway
  '700': 'bus',     // Bus Service
  '714': 'bus',     // Rail Replacement Bus
  '900': 'tram',    // Tram Service
  '1000': 'ferry',  // Water Transport
  '1501': 'bus',    // Communal taxi
};

function routeTypeToMode(routeType) {
  return GTFS_ROUTE_TYPE_TO_MODE[String(routeType)] || 'unknown';
}

/**
 * Load trip-mapping.json (built by scripts/build-trip-mapping.js).
 * Returns the mapping object or null if unavailable.
 */
async function loadTripMapping() {
  if (tripMappingCache !== undefined) return tripMappingCache;

  try {
    const response = await fetch('/data/trip-mapping.json');
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

/**
 * Fetch SL line information to map GIDs to line designations
 */
export async function fetchSLLines() {
  if (linesCache) return linesCache;

  try {
    const response = await fetch('https://transport.integration.sl.se/v1/lines?transport_authority_id=1');
    const data = await response.json();

    // Create a map of GID to line info
    const lineMap = new Map();
    // Reverse map: designation → mode (for vehicle.label fallback)
    const designationMap = new Map();

    // Add all transport modes
    ['metro', 'bus', 'train', 'tram', 'ship', 'ferry'].forEach(mode => {
      if (data[mode]) {
        data[mode].forEach(line => {
          lineMap.set(line.gid.toString(), {
            designation: line.designation,
            name: line.name,
            mode: mode,
            groupOfLines: line.group_of_lines
          });
          if (line.designation) {
            designationMap.set(line.designation, mode);
          }
        });
      }
    });

    linesCache = lineMap;
    designationModeCache = designationMap;
    return lineMap;
  } catch (error) {
    console.error('Error fetching SL lines:', error);
    return new Map();
  }
}

/**
 * Fetch and parse GTFS-RT vehicle positions
 */
export async function fetchVehiclePositions() {
  try {
    const [linesMap, tripMapping, response] = await Promise.all([
      fetchSLLines(),
      loadTripMapping(),
      fetch(API_URL, {
        headers: { 'Accept-Encoding': 'gzip' }
      })
    ]);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Parse GTFS-RT protobuf
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buffer);

    const timestamp = feed.header.timestamp;

    let identifiedCount = 0;
    let totalCount = 0;

    // Transform to simplified format
    const vehicles = feed.entity
      .filter(entity => entity.vehicle && entity.vehicle.position)
      .map(entity => {
        const v = entity.vehicle;
        const routeId = v.trip?.routeId;
        const tripId = v.trip?.tripId;
        const vehicleLabel = v.vehicle?.label;

        // Layer 1: GID lookup from SL Lines API (existing primary method)
        const lineInfo = routeId ? linesMap.get(routeId) : null;

        // Layer 2: vehicle.label as fallback line designation
        let line = lineInfo?.designation;
        let mode = lineInfo?.mode;

        if (!line && vehicleLabel && designationModeCache) {
          const labelMode = designationModeCache.get(vehicleLabel);
          if (labelMode) {
            line = vehicleLabel;
            if (!mode) mode = labelMode;
          }
        }

        // Layer 3: trip-mapping.json fallback
        if (!mode && tripId && tripMapping) {
          const tripInfo = tripMapping[tripId];
          if (tripInfo) {
            if (!line) line = tripInfo.line;
            mode = routeTypeToMode(tripInfo.routeType);
          }
        }

        totalCount++;
        if (mode && mode !== 'unknown') identifiedCount++;

        return {
          id: v.vehicle?.id || entity.id,
          routeId: routeId,
          line: line || routeId || 'Unknown',
          lineName: lineInfo?.name || '',
          mode: mode || 'unknown',
          latitude: v.position.latitude,
          longitude: v.position.longitude,
          bearing: v.position.bearing || 0,
          speed: v.position.speed || 0, // m/s
          timestamp: v.timestamp || timestamp,
          tripId: tripId,
          direction: v.trip?.directionId
        };
      })
      .filter(v => v.latitude && v.longitude); // Only valid coordinates

    const pct = totalCount > 0 ? ((identifiedCount / totalCount) * 100).toFixed(1) : '0.0';
    console.log(`Vehicle identification: ${identifiedCount}/${totalCount} (${pct}%)`);

    return vehicles;
  } catch (error) {
    console.error('Error fetching vehicle positions:', error);
    throw error;
  }
}
