import { describe, it, expect } from 'vitest';
import {
  TRAFIKLAB_HOST,
  OSM_TILE_HOST,
  CARTO_TILE_HOST,
  TRIP_MAPPING_PATH,
  TILE_CACHE_NAME,
  TILE_CACHE_MAX_ENTRIES,
  TILE_CACHE_MAX_AGE_SECONDS,
  TRIP_MAPPING_CACHE_NAME,
  TRIP_MAPPING_GLOB,
  precacheGlobPatterns,
  precacheGlobIgnores,
  isLiveFeedUrl,
  isTileUrl,
  isTripMappingUrl,
  runtimeCacheRoutes,
} from './swCacheConfig';

describe('swCacheConfig', () => {
  describe('TRAFIKLAB_HOST', () => {
    it('is the samtrafiken feed hostname', () => {
      expect(TRAFIKLAB_HOST).toBe('opendata.samtrafiken.se');
    });
  });

  describe('precacheGlobPatterns', () => {
    it('includes JS bundles', () => {
      expect(precacheGlobPatterns.some(p => p.includes('js'))).toBe(true);
    });

    it('includes CSS bundles', () => {
      expect(precacheGlobPatterns.some(p => p.includes('css'))).toBe(true);
    });

    it('includes HTML entry', () => {
      expect(precacheGlobPatterns.some(p => p.includes('html'))).toBe(true);
    });

    it('does not reference the Trafiklab host', () => {
      expect(precacheGlobPatterns.join(' ')).not.toContain(TRAFIKLAB_HOST);
    });
  });

  describe('precacheGlobIgnores', () => {
    it('contains the trip-mapping exclude pattern', () => {
      expect(precacheGlobIgnores).toContain(TRIP_MAPPING_GLOB);
    });

    it('does not exclude JS/CSS/HTML bundles', () => {
      const joined = precacheGlobIgnores.join(' ');
      expect(joined).not.toMatch(/\*\*\/\*\.\{js,css,html/);
    });
  });

  describe('isLiveFeedUrl', () => {
    it('returns true for a Trafiklab feed URL', () => {
      expect(
        isLiveFeedUrl(
          `https://${TRAFIKLAB_HOST}/gtfs-rt-sweden/sl/VehiclePositionsSweden.pb?key=abc`
        )
      ).toBe(true);
    });

    it('returns false for an OSM tile URL', () => {
      expect(isLiveFeedUrl('https://a.tile.openstreetmap.org/12/1234/2345.png')).toBe(false);
    });

    it('returns false for a CARTO dark tile URL', () => {
      expect(isLiveFeedUrl('https://a.basemaps.cartocdn.com/dark_all/12/1234/2345.png')).toBe(
        false
      );
    });

    it('returns false for the trip-mapping path', () => {
      expect(isLiveFeedUrl('/data/trip-mapping.json')).toBe(false);
    });

    it('returns false for an app-origin URL', () => {
      expect(isLiveFeedUrl('https://example.com/')).toBe(false);
    });

    it('returns false for an empty string', () => {
      expect(isLiveFeedUrl('')).toBe(false);
    });
  });

  describe('OSM_TILE_HOST', () => {
    it('is the openstreetmap tile hostname', () => {
      expect(OSM_TILE_HOST).toBe('tile.openstreetmap.org');
    });
  });

  describe('CARTO_TILE_HOST', () => {
    it('is the cartocdn tile hostname', () => {
      expect(CARTO_TILE_HOST).toBe('basemaps.cartocdn.com');
    });
  });

  describe('TRIP_MAPPING_PATH', () => {
    it('points at the static trip-mapping JSON', () => {
      expect(TRIP_MAPPING_PATH).toBe('/data/trip-mapping.json');
    });
  });

  describe('isTileUrl', () => {
    it('returns true for an OSM tile URL', () => {
      expect(isTileUrl('https://a.tile.openstreetmap.org/12/1234/2345.png')).toBe(true);
    });

    it('returns true for a CARTO dark tile URL', () => {
      expect(isTileUrl('https://a.basemaps.cartocdn.com/dark_all/12/1234/2345.png')).toBe(true);
    });

    it('returns false for a Trafiklab feed URL', () => {
      expect(
        isTileUrl(
          `https://${TRAFIKLAB_HOST}/gtfs-rt-sweden/sl/VehiclePositionsSweden.pb?key=abc`
        )
      ).toBe(false);
    });

    it('returns false for the trip-mapping URL', () => {
      expect(isTileUrl('/data/trip-mapping.json')).toBe(false);
    });

    it('returns false for an app origin URL', () => {
      expect(isTileUrl('https://example.com/')).toBe(false);
    });

    it('returns false for an empty string', () => {
      expect(isTileUrl('')).toBe(false);
    });
  });

  describe('isTripMappingUrl', () => {
    it('returns true for the trip-mapping path', () => {
      expect(isTripMappingUrl('/data/trip-mapping.json')).toBe(true);
    });

    it('returns true for a versioned trip-mapping URL', () => {
      expect(isTripMappingUrl('https://example.com/data/trip-mapping.json')).toBe(true);
    });

    it('returns false for an OSM tile URL', () => {
      expect(isTripMappingUrl('https://a.tile.openstreetmap.org/12/1234/2345.png')).toBe(false);
    });

    it('returns false for a Trafiklab feed URL', () => {
      expect(
        isTripMappingUrl(
          `https://${TRAFIKLAB_HOST}/gtfs-rt-sweden/sl/VehiclePositionsSweden.pb?key=abc`
        )
      ).toBe(false);
    });

    it('returns false for an empty string', () => {
      expect(isTripMappingUrl('')).toBe(false);
    });
  });

  describe('runtimeCacheRoutes', () => {
    it('has exactly two routes', () => {
      expect(runtimeCacheRoutes).toHaveLength(2);
    });

    it('first route is CacheFirst (tiles)', () => {
      expect(runtimeCacheRoutes[0].handler).toBe('CacheFirst');
    });

    it('second route is StaleWhileRevalidate (trip mapping)', () => {
      expect(runtimeCacheRoutes[1].handler).toBe('StaleWhileRevalidate');
    });

    it('tile route uses TILE_CACHE_NAME', () => {
      expect(runtimeCacheRoutes[0].options.cacheName).toBe(TILE_CACHE_NAME);
    });

    it('trip-mapping route uses TRIP_MAPPING_CACHE_NAME', () => {
      expect(runtimeCacheRoutes[1].options.cacheName).toBe(TRIP_MAPPING_CACHE_NAME);
    });

    it('tile cache expiration maxEntries matches TILE_CACHE_MAX_ENTRIES', () => {
      expect(runtimeCacheRoutes[0].options.expiration.maxEntries).toBe(TILE_CACHE_MAX_ENTRIES);
    });

    it('tile cache expiration maxAgeSeconds matches TILE_CACHE_MAX_AGE_SECONDS', () => {
      expect(runtimeCacheRoutes[0].options.expiration.maxAgeSeconds).toBe(
        TILE_CACHE_MAX_AGE_SECONDS
      );
    });

    it('TILE_CACHE_MAX_ENTRIES is at most 200', () => {
      expect(TILE_CACHE_MAX_ENTRIES).toBeLessThanOrEqual(200);
    });

    it('TILE_CACHE_MAX_AGE_SECONDS is at most 7 days', () => {
      expect(TILE_CACHE_MAX_AGE_SECONDS).toBeLessThanOrEqual(7 * 24 * 60 * 60);
    });

    it('trip-mapping route caps at 1 entry', () => {
      expect(runtimeCacheRoutes[1].options.expiration.maxEntries).toBe(1);
    });

    it('tile route urlPattern matches an OSM tile URL', () => {
      expect(
        runtimeCacheRoutes[0].urlPattern.test(
          'https://a.tile.openstreetmap.org/12/1234/2345.png'
        )
      ).toBe(true);
    });

    it('tile route urlPattern matches a CARTO tile URL', () => {
      expect(
        runtimeCacheRoutes[0].urlPattern.test(
          'https://a.basemaps.cartocdn.com/dark_all/12/1234/2345.png'
        )
      ).toBe(true);
    });

    it('tile route urlPattern does NOT match a Trafiklab URL', () => {
      expect(
        runtimeCacheRoutes[0].urlPattern.test(
          `https://${TRAFIKLAB_HOST}/gtfs-rt-sweden/sl/VehiclePositionsSweden.pb?key=abc`
        )
      ).toBe(false);
    });

    it('trip-mapping route urlPattern matches the trip-mapping URL', () => {
      expect(
        runtimeCacheRoutes[1].urlPattern.test('https://example.com/data/trip-mapping.json')
      ).toBe(true);
    });

    it('trip-mapping route urlPattern does NOT match a Trafiklab URL', () => {
      expect(
        runtimeCacheRoutes[1].urlPattern.test(
          `https://${TRAFIKLAB_HOST}/gtfs-rt-sweden/sl/VehiclePositionsSweden.pb?key=abc`
        )
      ).toBe(false);
    });

    it('no route matches a Trafiklab URL (allowlist exhausted)', () => {
      const trafiklabUrl = `https://${TRAFIKLAB_HOST}/gtfs-rt-sweden/sl/VehiclePositionsSweden.pb?key=abc`;
      const matched = runtimeCacheRoutes.some(r => r.urlPattern.test(trafiklabUrl));
      expect(matched).toBe(false);
    });
  });
});
