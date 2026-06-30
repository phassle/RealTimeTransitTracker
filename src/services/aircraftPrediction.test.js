import { describe, it, expect } from 'vitest';
import { projectPosition, predictAircraft } from './aircraftPrediction';
import { KM_PER_NM, KM_PER_DEGREE_LAT } from './aircraft';

const STHLM = { latitude: 59.33, longitude: 18.07 };

describe('projectPosition — dead-reckoning a single aircraft', () => {
  it('moves due north for bearing 0', () => {
    const [lat, lon] = projectPosition({ ...STHLM, bearing: 0, speed: 600 }, 3600); // 1 h
    expect(lat).toBeGreaterThan(STHLM.latitude);
    expect(lon).toBeCloseTo(STHLM.longitude, 6); // no east/west drift
  });

  it('moves due east for bearing 90', () => {
    const [lat, lon] = projectPosition({ ...STHLM, bearing: 90, speed: 600 }, 3600);
    expect(lon).toBeGreaterThan(STHLM.longitude);
    expect(lat).toBeCloseTo(STHLM.latitude, 6);
  });

  it('covers ground-speed × time (knots → nm) along the track', () => {
    // 600 kn for 10 s = 600 * (10/3600) nm ≈ 1.667 nm north.
    const elapsed = 10;
    const [lat] = projectPosition({ ...STHLM, bearing: 0, speed: 600 }, elapsed);
    const expectedKmNorth = 600 * (elapsed / 3600) * KM_PER_NM;
    const expectedDLat = expectedKmNorth / KM_PER_DEGREE_LAT;
    expect(lat - STHLM.latitude).toBeCloseTo(expectedDLat, 6);
  });

  it('leaves a hovering / zero-speed aircraft in place', () => {
    expect(projectPosition({ ...STHLM, bearing: 120, speed: 0 }, 10)).toEqual([59.33, 18.07]);
  });

  it('guards a non-finite speed and zero/negative elapsed', () => {
    expect(projectPosition({ ...STHLM, bearing: 90, speed: NaN }, 10)).toEqual([59.33, 18.07]);
    expect(projectPosition({ ...STHLM, bearing: 90, speed: 600 }, 0)).toEqual([59.33, 18.07]);
  });
});

describe('predictAircraft — projecting a list', () => {
  it('advances each aircraft and preserves id/extra fields', () => {
    const ac = [{ id: 'air:a', latitude: 59.33, longitude: 18.07, bearing: 0, speed: 480, line: 'SAS1' }];
    const [p] = predictAircraft(ac, 10);
    expect(p.id).toBe('air:a');
    expect(p.line).toBe('SAS1');
    expect(p.latitude).toBeGreaterThan(59.33);
  });

  it('returns the same entries (identity) when nothing moves', () => {
    const ac = [{ id: 'air:h', latitude: 59.33, longitude: 18.07, bearing: 0, speed: 0 }];
    const out = predictAircraft(ac, 10);
    expect(out[0]).toBe(ac[0]); // unchanged reference — no needless marker churn
  });

  it('is a no-op for zero elapsed', () => {
    const ac = [{ id: 'air:a', latitude: 1, longitude: 2, bearing: 0, speed: 400 }];
    expect(predictAircraft(ac, 0)).toBe(ac);
  });
});
