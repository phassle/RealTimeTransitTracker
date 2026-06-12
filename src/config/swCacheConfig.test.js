import { describe, it, expect } from 'vitest';
import {
  TILE_CACHE_NAME,
  TILE_CACHE_MAX_ENTRIES,
  TILE_CACHE_MAX_AGE_SECONDS,
  TRIP_MAPPING_CACHE_NAME,
  TRIP_MAPPING_GLOB,
  precacheGlobPatterns,
  precacheGlobIgnores,
  runtimeCacheRoutes,
} from './swCacheConfig';
import { TRAFIKLAB_FEED_BASE } from './endpoints';

describe('swCacheConfig', () => {
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
      expect(precacheGlobPatterns.join(' ')).not.toContain('samtrafiken.se');
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
          `${TRAFIKLAB_FEED_BASE}/sl/VehiclePositionsSweden.pb?key=abc`
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
          `${TRAFIKLAB_FEED_BASE}/sl/VehiclePositionsSweden.pb?key=abc`
        )
      ).toBe(false);
    });

    it('no route matches a Trafiklab URL (allowlist exhausted)', () => {
      const trafiklabUrl = `${TRAFIKLAB_FEED_BASE}/sl/VehiclePositionsSweden.pb?key=abc`;
      const matched = runtimeCacheRoutes.some(r => r.urlPattern.test(trafiklabUrl));
      expect(matched).toBe(false);
    });
  });
});
