import { describe, it, expect } from 'vitest';
import {
  detectStationaryAnomalies,
  learnDwellSpots,
  distanceMeters,
  STATIONARY_DURATION_MS,
  DISPLACEMENT_THRESHOLD_M,
  DWELL_MIN_DISTINCT_VEHICLES,
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

  // Issue #169 — a hovering helicopter is an Aircraft, not transit, and must
  // never raise a stationary-vehicle Anomaly. Aircraft Vehicles (mapAircraft
  // shape: `air:`+hex id, helicopter mode, no operator, no tripId) carry no
  // active trip, so even if one reached this rule it raises nothing.
  it('does not flag a hovering helicopter (no active trip, aircraft Vehicle)', () => {
    const helicopter = (overrides = {}) => ({
      id: 'air:4ca7b2',
      mode: 'helicopter',
      line: 'POL01',
      latitude: 59.3293,
      longitude: 18.0686,
      ...overrides,
    });
    // Perfectly stationary over well past the threshold — would flag if it were
    // a transit vehicle on an active trip, but a helicopter has no tripId.
    const snaps = track([0, 3 * MIN, 6 * MIN], () => helicopter());
    expect(detectStationaryAnomalies(snaps, 6 * MIN)).toHaveLength(0);
  });

  it('ignores tiny jitter below the displacement threshold', () => {
    // ~10 m of GPS jitter, under the 30 m threshold → still counts as stationary.
    const snaps = track([0, 3 * MIN, 6 * MIN], (time) => {
      const jitter = (time / (3 * MIN)) * 0.00009; // ~10 m steps
      return vehicle({ latitude: 59.3293 + jitter });
    });
    expect(detectStationaryAnomalies(snaps, 6 * MIN)).toHaveLength(1);
  });

  it('preserves first-match semantics for duplicate vehicle ids after indexing', () => {
    const dupStationary = vehicle({ id: 'dup' });
    const dupMoved = vehicle({ id: 'dup', latitude: 59.4 });
    const snaps = [
      { time: 0, vehicles: [vehicle({ id: 'first' }), vehicle({ id: 'second' }), dupStationary] },
      {
        time: 3 * MIN,
        vehicles: [
          vehicle({ id: 'first' }),
          vehicle({ id: 'second' }),
          dupMoved,
          dupStationary,
        ],
      },
      {
        time: 6 * MIN,
        vehicles: [vehicle({ id: 'first' }), vehicle({ id: 'second' }), dupStationary],
      },
    ];

    const vehicleIds = detectStationaryAnomalies(snaps, 6 * MIN).map((a) => a.vehicleId);
    expect(vehicleIds).toEqual(['first', 'second']);
  });
});

// Two locations: A is a habitual stop (terminal), B is far away (~8 km).
const SPOT_A = { latitude: 59.33, longitude: 18.07 };
const SPOT_B = { latitude: 59.4, longitude: 18.2 };

function veh(id, pos) {
  return {
    id,
    operator: 'sl',
    line: '4',
    tripId: `trip-${id}`,
    latitude: pos.latitude,
    longitude: pos.longitude,
  };
}

describe('learnDwellSpots — session-learned suppression zones', () => {
  it('learns a Dwell spot where many distinct vehicles have stood still', () => {
    // three distinct vehicles each stand at A across two consecutive snapshots
    const snaps = [
      { time: 0, vehicles: [veh('v1', SPOT_A), veh('v2', SPOT_A), veh('v3', SPOT_A)] },
      { time: 3 * MIN, vehicles: [veh('v1', SPOT_A), veh('v2', SPOT_A), veh('v3', SPOT_A)] },
    ];
    const spots = learnDwellSpots(snaps);
    expect(spots).toHaveLength(1);
    expect(spots[0].distinctVehicles).toBe(DWELL_MIN_DISTINCT_VEHICLES);
    expect(
      distanceMeters(spots[0].latitude, spots[0].longitude, SPOT_A.latitude, SPOT_A.longitude),
    ).toBeLessThan(10);
  });

  it('does not learn a spot where only one vehicle has stood (a real stall)', () => {
    const snaps = [
      { time: 0, vehicles: [veh('stuck', SPOT_B)] },
      { time: 3 * MIN, vehicles: [veh('stuck', SPOT_B)] },
      { time: 6 * MIN, vehicles: [veh('stuck', SPOT_B)] },
    ];
    expect(learnDwellSpots(snaps)).toHaveLength(0);
  });
});

describe('detectStationaryAnomalies — Dwell spot suppression', () => {
  it('suppresses a stationary detection at a learned Dwell spot', () => {
    // history establishes A as a Dwell spot; a fourth vehicle now stands there
    const snaps = [
      { time: 0, vehicles: [veh('v1', SPOT_A), veh('v2', SPOT_A), veh('v3', SPOT_A), veh('v4', SPOT_A)] },
      { time: 3 * MIN, vehicles: [veh('v1', SPOT_A), veh('v2', SPOT_A), veh('v3', SPOT_A), veh('v4', SPOT_A)] },
      { time: 6 * MIN, vehicles: [veh('v4', SPOT_A)] },
    ];
    const dwellSpots = learnDwellSpots(snaps);
    expect(detectStationaryAnomalies(snaps, 6 * MIN, { dwellSpots })).toHaveLength(0);
  });

  it('still flags a stationary vehicle away from any Dwell spot', () => {
    // A is a Dwell spot (v1..v3); 'stuck' stands at far-away B beyond threshold
    const snaps = [
      { time: 0, vehicles: [veh('v1', SPOT_A), veh('v2', SPOT_A), veh('v3', SPOT_A), veh('stuck', SPOT_B)] },
      { time: 3 * MIN, vehicles: [veh('v1', SPOT_A), veh('v2', SPOT_A), veh('v3', SPOT_A), veh('stuck', SPOT_B)] },
      { time: 6 * MIN, vehicles: [veh('stuck', SPOT_B)] },
    ];
    const dwellSpots = learnDwellSpots(snaps);
    expect(dwellSpots).toHaveLength(1); // only A learned
    const anomalies = detectStationaryAnomalies(snaps, 6 * MIN, { dwellSpots });
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].vehicleId).toBe('stuck');
  });

  it('flags as usual when no Dwell spots are supplied', () => {
    const snaps = track([0, 3 * MIN, 6 * MIN], () => vehicle());
    expect(detectStationaryAnomalies(snaps, 6 * MIN, { dwellSpots: [] })).toHaveLength(1);
  });
});
