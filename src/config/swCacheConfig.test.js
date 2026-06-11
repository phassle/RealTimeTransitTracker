import { describe, it, expect } from 'vitest';
import {
  TRAFIKLAB_HOST,
  TRIP_MAPPING_GLOB,
  precacheGlobPatterns,
  precacheGlobIgnores,
  isLiveFeedUrl,
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
});
