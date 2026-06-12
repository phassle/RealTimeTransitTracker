import { describe, it, expect } from 'vitest';
import {
  TRAFIKLAB_FEED_BASE,
  TRIP_MAPPING_URL,
  LIGHT_TILES,
  DARK_TILES,
} from './endpoints';
import { runtimeCacheRoutes } from './swCacheConfig';
import * as swCacheConfig from './swCacheConfig';

describe('endpoints', () => {
  it('TRAFIKLAB_FEED_BASE is on opendata.samtrafiken.se', () => {
    expect(TRAFIKLAB_FEED_BASE).toContain('opendata.samtrafiken.se');
  });

  it('TRIP_MAPPING_URL points at trip-mapping.json', () => {
    expect(TRIP_MAPPING_URL).toContain('trip-mapping.json');
  });

  it('LIGHT_TILES urlTemplate is on tile.openstreetmap.org', () => {
    expect(LIGHT_TILES.urlTemplate).toContain('openstreetmap.org');
  });

  it('LIGHT_TILES attribution credits OpenStreetMap', () => {
    expect(LIGHT_TILES.attribution).toContain('OpenStreetMap');
  });

  it('LIGHT_TILES attribution credits Trafiklab', () => {
    expect(LIGHT_TILES.attribution).toContain('Trafiklab');
  });

  it('DARK_TILES urlTemplate is on basemaps.cartocdn.com', () => {
    expect(DARK_TILES.urlTemplate).toContain('cartocdn.com');
  });

  it('DARK_TILES attribution credits CARTO', () => {
    expect(DARK_TILES.attribution).toContain('CARTO');
  });

  it('DARK_TILES attribution credits OpenStreetMap', () => {
    expect(DARK_TILES.attribution).toContain('OpenStreetMap');
  });
});

describe('endpoints ↔ SW-cache invariant', () => {
  function sampleTileUrl(urlTemplate) {
    return urlTemplate
      .replace('{s}', 'a')
      .replace('{z}', '12')
      .replace('{x}', '1234')
      .replace('{y}', '2345')
      .replace('{r}', '@2x');
  }

  const tileRoute = runtimeCacheRoutes.find(r => r.handler === 'CacheFirst');
  const tripMappingRoute = runtimeCacheRoutes.find(r => r.handler === 'StaleWhileRevalidate');

  it('a URL derived from LIGHT_TILES matches the SW tile cache route', () => {
    expect(tileRoute.urlPattern.test(sampleTileUrl(LIGHT_TILES.urlTemplate))).toBe(true);
  });

  it('a URL derived from DARK_TILES matches the SW tile cache route', () => {
    expect(tileRoute.urlPattern.test(sampleTileUrl(DARK_TILES.urlTemplate))).toBe(true);
  });

  it('TRIP_MAPPING_URL matches the SW trip-mapping cache route', () => {
    expect(tripMappingRoute.urlPattern.test(TRIP_MAPPING_URL)).toBe(true);
  });

  it('a URL derived from TRAFIKLAB_FEED_BASE does not match the SW tile route', () => {
    const feedUrl = `${TRAFIKLAB_FEED_BASE}/sl/VehiclePositionsSweden.pb?key=abc`;
    expect(tileRoute.urlPattern.test(feedUrl)).toBe(false);
  });

  it('a URL derived from TRAFIKLAB_FEED_BASE does not match the SW trip-mapping route', () => {
    const feedUrl = `${TRAFIKLAB_FEED_BASE}/sl/VehiclePositionsSweden.pb?key=abc`;
    expect(tripMappingRoute.urlPattern.test(feedUrl)).toBe(false);
  });

  it('isTileUrl predicate is not part of the sw-cache interface', () => {
    expect(swCacheConfig.isTileUrl).toBeUndefined();
  });

  it('isLiveFeedUrl predicate is not part of the sw-cache interface', () => {
    expect(swCacheConfig.isLiveFeedUrl).toBeUndefined();
  });

  it('isTripMappingUrl predicate is not part of the sw-cache interface', () => {
    expect(swCacheConfig.isTripMappingUrl).toBeUndefined();
  });
});
