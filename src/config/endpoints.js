// Single source of truth for every external URL the app fetches.
// Fetchers and the service-worker cache routes both derive from these declarations,
// so a provider change cannot silently desync offline caching.

export const TRAFIKLAB_FEED_BASE = 'https://opendata.samtrafiken.se/gtfs-rt-sweden';

export const TRIP_MAPPING_URL = '/data/trip-mapping.json';

// airplanes.live — unauthenticated, CORS-open (access-control-allow-origin: *),
// so it is fetched directly from the browser with no proxy (ADR 0001 intact),
// under Non-Commercial Use / no SLA. Disclosed in the Privacy Notice; chosen and
// licence-framed in ADR 0007 (docs/adr/0007-aircraft-airplanes-live-client-side.md).
// Point endpoint: `${base}/point/{lat}/{lon}/{radius_nm}` (radius ≤ 250 nm).
export const AIRPLANES_LIVE_BASE = 'https://api.airplanes.live/v2';

export const LIGHT_TILES = {
  urlTemplate: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Data: <a href="https://trafiklab.se">Trafiklab</a>',
};

export const DARK_TILES = {
  urlTemplate: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  attribution:
    '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
};
