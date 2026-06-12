import { describe, it, expect } from 'vitest';
import {
  CAMERA_TYPE_DEFINITIONS,
  cameraCountsByType,
  filterCamerasByType,
} from './cameraTypeFilter';

const cam = (id, type) => ({
  id,
  name: id,
  type,
  media: 'linkout',
  lat: 59,
  lon: 18,
  imageUrl: null,
  pageUrl: 'https://example.test/',
  source: 'test',
  attribution: 'test',
  lastUpdated: null,
});

const SAMPLE = [
  cam('a', 'traffic'),
  cam('b', 'traffic'),
  cam('c', 'weather'),
  cam('d', 'ski'),
  cam('e', 'ski'),
  cam('f', 'ski'),
  cam('g', 'construction'),
  cam('h', 'wildlife'),
];

describe('CAMERA_TYPE_DEFINITIONS', () => {
  it('lists the five PRD types in stable order with id+label', () => {
    expect(CAMERA_TYPE_DEFINITIONS.map(t => t.id)).toEqual([
      'traffic',
      'weather',
      'ski',
      'construction',
      'wildlife',
    ]);
    for (const t of CAMERA_TYPE_DEFINITIONS) {
      expect(typeof t.id).toBe('string');
      expect(typeof t.label).toBe('string');
      expect(t.label.length).toBeGreaterThan(0);
    }
  });
});

describe('cameraCountsByType', () => {
  it('returns the count for every camera type, even zeroes', () => {
    const counts = cameraCountsByType(SAMPLE);
    expect(counts).toEqual({
      traffic: 2,
      weather: 1,
      ski: 3,
      construction: 1,
      wildlife: 1,
    });
  });

  it('returns all-zero counts for an empty list', () => {
    expect(cameraCountsByType([])).toEqual({
      traffic: 0,
      weather: 0,
      ski: 0,
      construction: 0,
      wildlife: 0,
    });
  });

  it('tolerates a camera with an unexpected type (does not crash, does not count)', () => {
    const counts = cameraCountsByType([cam('x', 'bogus'), ...SAMPLE]);
    expect(counts.traffic).toBe(2);
    expect(counts).not.toHaveProperty('bogus');
  });
});

describe('filterCamerasByType', () => {
  it('keeps only cameras whose type is in the enabled set', () => {
    const result = filterCamerasByType(SAMPLE, ['ski']);
    expect(result.map(c => c.id).sort()).toEqual(['d', 'e', 'f']);
  });

  it('with all types enabled returns the input list unchanged', () => {
    const all = ['traffic', 'weather', 'ski', 'construction', 'wildlife'];
    expect(filterCamerasByType(SAMPLE, all)).toEqual(SAMPLE);
  });

  it('with no types enabled returns an empty list', () => {
    expect(filterCamerasByType(SAMPLE, [])).toEqual([]);
  });

  it('drops cameras whose type is not in the enum even when the type is listed', () => {
    const mixed = [cam('x', 'bogus'), ...SAMPLE];
    const result = filterCamerasByType(mixed, ['traffic']);
    expect(result.map(c => c.id).sort()).toEqual(['a', 'b']);
  });
});
