import { describe, it, expect } from 'vitest';
import { curatedCameraSchema, validateCuratedDataset } from './curatedCameras';
import curatedDataset from '../../public/data/curated-cameras.json';

// Sweden's rough WGS84 bounding box (PRD #66 / issue #69 acceptance criterion).
// Cameras outside this box are rejected.
const SWEDEN_BOUNDS = { south: 55.0, west: 10.5, north: 69.5, east: 24.5 };

const VALID_ENTRY = {
  id: 'webcamcollections:fjallbacka',
  name: 'Fjällbacka',
  type: 'weather',
  media: 'linkout',
  lat: 58.6,
  lon: 11.28,
  imageUrl: null,
  pageUrl: 'https://webcamcollections.com/countries/sweden/fjallbacka',
  source: 'webcamcollections',
  attribution: 'webcamcollections.com',
  lastUpdated: null,
};

describe('curatedCameraSchema', () => {
  it('accepts a well-formed linkout camera entry', () => {
    const parsed = curatedCameraSchema.parse(VALID_ENTRY);
    expect(parsed.name).toBe('Fjällbacka');
    expect(parsed.media).toBe('linkout');
  });

  it('rejects coordinates outside Sweden — too far south', () => {
    expect(() => curatedCameraSchema.parse({ ...VALID_ENTRY, lat: 40.0 })).toThrow();
  });

  it('rejects coordinates outside Sweden — too far east', () => {
    expect(() => curatedCameraSchema.parse({ ...VALID_ENTRY, lon: 30.0 })).toThrow();
  });

  it('rejects a type value not in the Camera-type enum', () => {
    expect(() => curatedCameraSchema.parse({ ...VALID_ENTRY, type: 'spaceship' })).toThrow();
  });

  it('rejects a non-https pageUrl', () => {
    expect(() =>
      curatedCameraSchema.parse({
        ...VALID_ENTRY,
        pageUrl: 'http://webcamcollections.com/countries/sweden/fjallbacka',
      }),
    ).toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => curatedCameraSchema.parse({ ...VALID_ENTRY, name: '' })).toThrow();
  });

  it('rejects an empty attribution', () => {
    expect(() => curatedCameraSchema.parse({ ...VALID_ENTRY, attribution: '' })).toThrow();
  });

  it('rejects a media value not in the Media-capability enum', () => {
    expect(() => curatedCameraSchema.parse({ ...VALID_ENTRY, media: 'gif' })).toThrow();
  });
});

describe('validateCuratedDataset', () => {
  it('passes through a valid array unchanged', () => {
    const result = validateCuratedDataset([VALID_ENTRY]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(VALID_ENTRY.id);
  });

  it('identifies the offending entry on schema violation', () => {
    const bad = { ...VALID_ENTRY, id: 'webcamcollections:bad', type: 'spaceship' };
    let caught;
    try {
      validateCuratedDataset([VALID_ENTRY, bad]);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    expect(String(caught.message)).toContain('webcamcollections:bad');
  });
});

describe('the checked-in curated dataset', () => {
  it('contains the expected 89 camera entries (Appendix A of #65)', () => {
    expect(Array.isArray(curatedDataset)).toBe(true);
    expect(curatedDataset).toHaveLength(89);
  });

  it('every entry passes the curated camera schema', () => {
    expect(() => validateCuratedDataset(curatedDataset)).not.toThrow();
  });

  it('every entry is media:linkout (no inline media for the curated source)', () => {
    for (const cam of curatedDataset) {
      expect(cam.media).toBe('linkout');
    }
  });

  it('every entry lies within Sweden bounds', () => {
    for (const cam of curatedDataset) {
      expect(cam.lat).toBeGreaterThanOrEqual(SWEDEN_BOUNDS.south);
      expect(cam.lat).toBeLessThanOrEqual(SWEDEN_BOUNDS.north);
      expect(cam.lon).toBeGreaterThanOrEqual(SWEDEN_BOUNDS.west);
      expect(cam.lon).toBeLessThanOrEqual(SWEDEN_BOUNDS.east);
    }
  });

});
