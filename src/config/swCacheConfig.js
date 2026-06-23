import { LIGHT_TILES, DARK_TILES, TRIP_MAPPING_URL } from './endpoints.js';

function hostFromTileTemplate(urlTemplate) {
  return urlTemplate
    .replace(/^https?:\/\//, '')
    .replace(/^\{[^}]+\}\./, '')
    .split('/')[0];
}

function escapeHost(host) {
  return host.replace(/\./g, '\\.');
}

const osmHost = hostFromTileTemplate(LIGHT_TILES.urlTemplate);
const cartoHost = hostFromTileTemplate(DARK_TILES.urlTemplate);

export const TILE_CACHE_NAME = 'map-tiles';
export const TILE_CACHE_MAX_ENTRIES = 200;
export const TILE_CACHE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
export const TRIP_MAPPING_CACHE_NAME = 'trip-mapping';

export const TRIP_MAPPING_GLOB = '**/trip-mapping*.json';
export const precacheGlobPatterns = ['**/*.{js,css,html,ico,png,svg,woff2}'];
export const precacheGlobIgnores = [TRIP_MAPPING_GLOB];

// RegExp patterns are used directly in runtimeCacheRoutes so Workbox can
// serialise them cleanly into the generated sw.js without closure references.
export const TILE_URL_PATTERN = new RegExp(`${escapeHost(osmHost)}|${escapeHost(cartoHost)}`);
export const TRIP_MAPPING_URL_PATTERN = new RegExp(
  TRIP_MAPPING_URL.replace(/\//g, '\\/').replace('.', '\\.')
);

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
