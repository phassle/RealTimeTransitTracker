import { LIGHT_TILES, DARK_TILES } from '../config/endpoints.js';

export function tileLayerConfig(theme) {
  const tiles = theme === 'dark' ? DARK_TILES : LIGHT_TILES;
  return { url: tiles.urlTemplate, attribution: tiles.attribution };
}
