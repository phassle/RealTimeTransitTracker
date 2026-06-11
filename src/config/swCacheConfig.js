export const TRAFIKLAB_HOST = 'opendata.samtrafiken.se';
export const OSM_TILE_HOST = 'tile.openstreetmap.org';
export const CARTO_TILE_HOST = 'basemaps.cartocdn.com';
export const TRIP_MAPPING_PATH = '/data/trip-mapping.json';

export const TILE_CACHE_NAME = 'map-tiles';
export const TILE_CACHE_MAX_ENTRIES = 200;
export const TILE_CACHE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
export const TRIP_MAPPING_CACHE_NAME = 'trip-mapping';

export const TRIP_MAPPING_GLOB = '**/trip-mapping*.json';
export const precacheGlobPatterns = ['**/*.{js,css,html,ico,png,svg,woff2}'];
export const precacheGlobIgnores = [TRIP_MAPPING_GLOB];

export function isLiveFeedUrl(url) {
  return url.includes(TRAFIKLAB_HOST);
}

// RegExp patterns are used directly in runtimeCacheRoutes so Workbox can
// serialise them cleanly into the generated sw.js without closure references.
export const TILE_URL_PATTERN = new RegExp(
  `${OSM_TILE_HOST.replace('.', '\\.')}|${CARTO_TILE_HOST.replace('.', '\\.')}`
);
export const TRIP_MAPPING_URL_PATTERN = new RegExp(
  TRIP_MAPPING_PATH.replace(/\//g, '\\/').replace('.', '\\.')
);

export function isTileUrl(url) {
  return TILE_URL_PATTERN.test(url);
}

export function isTripMappingUrl(url) {
  return TRIP_MAPPING_URL_PATTERN.test(url);
}

export const runtimeCacheRoutes = [
  {
    urlPattern: TILE_URL_PATTERN,
    handler: 'CacheFirst',
    options: {
      cacheName: TILE_CACHE_NAME,
      expiration: {
        maxEntries: TILE_CACHE_MAX_ENTRIES,
        maxAgeSeconds: TILE_CACHE_MAX_AGE_SECONDS,
      },
    },
  },
  {
    urlPattern: TRIP_MAPPING_URL_PATTERN,
    handler: 'StaleWhileRevalidate',
    options: {
      cacheName: TRIP_MAPPING_CACHE_NAME,
      expiration: { maxEntries: 1 },
    },
  },
];
