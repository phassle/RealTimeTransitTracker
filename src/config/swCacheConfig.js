export const TRAFIKLAB_HOST = 'opendata.samtrafiken.se';
export const TRIP_MAPPING_GLOB = '**/trip-mapping*.json';

export const precacheGlobPatterns = ['**/*.{js,css,html,ico,png,svg,woff2}'];

export const precacheGlobIgnores = [TRIP_MAPPING_GLOB];

export function isLiveFeedUrl(url) {
  return url.includes(TRAFIKLAB_HOST);
}
