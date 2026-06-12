import { describe, it, expect } from 'vitest';
import {
  detectStationaryAnomalies,
  distanceMeters,
  STATIONARY_DURATION_MS,
  DISPLACEMENT_THRESHOLD_M,
} from './anomalyRules';

const MIN = 60 * 1000;

// A vehicle fixture at a fixed home position unless overridden.
function vehicle(overrides = {}) {
  return {
    id: 'sl:bus-1',
    operator: 'sl',
    line: '4',
    tripId: 'trip-abc',
    latitude: 59.3293,
    longitude: 18.0686,
    ...overrides,
  };
}

// Build snapshots: one vehicle observed at each of the given times.
function track(times, makeVehicle) {
  return times.map((time, i) => ({ time, vehicles: [makeVehicle(time, i)] }));
}

describe('distanceMeters', () => {
  it('is ~0 for identical points', () => {
    expect(distanceMeters(59.3, 18.0, 59.3, 18.0)).toBeLessThan(1);
  });

  it('measures a known separation', () => {
    // ~0.001 deg latitude ≈ 111 m
    const d = distanceMeters(59.3, 18.0, 59.301, 18.0);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });
});

describe('detectStationaryAnomalies — stationary on active trip', () => {
  it('flags a vehicle stationary on an active trip beyond the threshold', () => {
    const snaps = track([0, 3 * MIN, 6 * MIN], () => vehicle());
    const anomalies = detectStationaryAnomalies(snaps, 6 * MIN);

    expect(anomalies).toHaveLength(1);
    const a = anomalies[0];
    expect(a.ruleId).toBe('stationary-on-active-trip');
    expect(a.vehicleId).toBe('sl:bus-1');
    expect(a.line).toBe('4');
    expect(a.startedAt).toBe(0);
    expect(a.measuredStationaryMs).toBe(6 * MIN);
    expect(a.thresholdMs).toBe(STATIONARY_DURATION_MS);
    expect(a.displacementThresholdM).toBe(DISPLACEMENT_THRESHOLD_M);
    expect(a.latitude).toBe(59.3293);
  });

  it('does not flag a vehicle without an active trip', () => {
    const snaps = track([0, 3 * MIN, 6 * MIN], () => vehicle({ tripId: undefined }));
    expect(detectStationaryAnomalies(snaps, 6 * MIN)).toHaveLength(0);
  });

  it('does not flag a vehicle that is moving slowly but still progressing', () => {
    // Each poll the vehicle creeps ~25 m north; over 6 min it has covered ~150 m,
    // well past the displacement threshold, so the stationary span is short.
    const snaps = track([0, 3 * MIN, 6 * MIN], (time) => {
      const steps = time / (3 * MIN); // 0, 1, 2
      return vehicle({ latitude: 59.3293 + steps * 0.0009 });
    });
    expect(detectStationaryAnomalies(snaps, 6 * MIN)).toHaveLength(0);
  });

  it('does not flag a vehicle stationary for less than the threshold', () => {
    const snaps = track([0, 2 * MIN, 4 * MIN], () => vehicle());
    expect(detectStationaryAnomalies(snaps, 4 * MIN)).toHaveLength(0);
  });

  it('returns no anomalies for empty history', () => {
    expect(detectStationaryAnomalies([], 0)).toEqual([]);
  });

  it('ignores tiny jitter below the displacement threshold', () => {
    // ~10 m of GPS jitter, under the 30 m threshold → still counts as stationary.
    const snaps = track([0, 3 * MIN, 6 * MIN], (time) => {
      const jitter = (time / (3 * MIN)) * 0.00009; // ~10 m steps
      return vehicle({ latitude: 59.3293 + jitter });
    });
    expect(detectStationaryAnomalies(snaps, 6 * MIN)).toHaveLength(1);
  });
});
