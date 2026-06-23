import { describe, it, expect } from 'vitest';
import { predictImpact, coarseDelayLabel, CONFIDENCE_FLOOR } from './etaProjection';

const MIN = 60 * 1000;

// Fixture builders, mirroring the behaviour-only style of
// incidentClustering.test.js: synthetic vehicles + snapshots + Incident, no
// mocks, no I/O.
function vehicle(overrides = {}) {
  return {
    id: 'sl:bus-1',
    operator: 'sl',
    line: '4',
    direction: '0',
    latitude: 59.3293,
    longitude: 18.0686,
    bearing: 90,
    tripId: 'trip-abc',
    ...overrides,
  };
}

function snapshot(vehicles, time = 6 * MIN) {
  return { time, vehicles };
}

// A geographic Incident around a stalled vehicle, as clusterIncidents would
// produce it: subject at the stall point, vehicleIds listing the stalled bus.
function geographicIncident(overrides = {}) {
  return {
    id: 'stationary:sl:bus-1:0',
    status: 'open',
    subject: { kind: 'geographic', latitude: 59.3293, longitude: 18.0686 },
    lines: ['4'],
    vehicleIds: ['sl:bus-1'],
    operators: ['sl'],
    anomalies: [],
    ...overrides,
  };
}

describe('predictImpact', () => {
  it('projects downstream vehicles on the same line and direction as the stall', () => {
    const stalled = vehicle({ id: 'sl:bus-1' });
    const behind = vehicle({ id: 'sl:bus-2', latitude: 59.31, longitude: 18.06 });
    const buffer = [snapshot([stalled, behind])];

    const projection = predictImpact(geographicIncident(), buffer, 6 * MIN);

    expect(projection).not.toBeNull();
    expect(projection.affected).toHaveLength(1);
    const a = projection.affected[0];
    expect(a.line).toBe('4');
    expect(a.direction).toBe('0');
    expect(a.downstreamVehicleIds).toEqual(['sl:bus-2']);
  });

  it('excludes opposite-direction traffic from the projection', () => {
    const stalled = vehicle({ id: 'sl:bus-1', direction: '0' });
    const opposite = vehicle({ id: 'sl:bus-9', direction: '1', latitude: 59.31, longitude: 18.06 });
    const buffer = [snapshot([stalled, opposite])];

    const projection = predictImpact(geographicIncident(), buffer, 6 * MIN);

    expect(projection).toBeNull(); // no same-direction downstream vehicle ⇒ nothing to forecast
  });

  it('returns null for an operator-subject (feed outage) Incident', () => {
    const outage = {
      id: 'feed-outage:sl:0',
      status: 'open',
      subject: { kind: 'operator', operator: 'sl' },
      lines: [],
      vehicleIds: [],
      operators: ['sl'],
      anomalies: [],
    };
    const buffer = [snapshot([vehicle()])];

    expect(predictImpact(outage, buffer, 6 * MIN)).toBeNull();
  });

  it('retracts (returns null) once the stalled vehicle has moved away from the stall point', () => {
    // Same incident, but on the latest poll the stalled bus has progressed well
    // beyond the displacement threshold — the disruption cleared for it.
    const moved = vehicle({ id: 'sl:bus-1', latitude: 59.45, longitude: 18.2 });
    const behind = vehicle({ id: 'sl:bus-2', latitude: 59.31, longitude: 18.06 });
    const buffer = [snapshot([moved, behind])];

    expect(predictImpact(geographicIncident(), buffer, 6 * MIN)).toBeNull();
  });

  it('does not project a stall whose vehicle has an unknown direction', () => {
    const stalled = vehicle({ id: 'sl:bus-1', direction: null });
    const behind = vehicle({ id: 'sl:bus-2', direction: null, latitude: 59.31, longitude: 18.06 });
    const buffer = [snapshot([stalled, behind])];

    expect(predictImpact(geographicIncident(), buffer, 6 * MIN)).toBeNull();
  });

  // --- Slice 2: "behind" heuristic (bearing dot-product + distance cap) ---

  it('includes a same-line/direction vehicle upstream of the stall within the distance cap', () => {
    // Stalled heading east (bearing 90); candidate sits to the west (upstream),
    // a few hundred metres back — clearly behind and inside the cap.
    const stalled = vehicle({ id: 'sl:bus-1', bearing: 90 });
    const upstream = vehicle({ id: 'sl:bus-2', longitude: 18.06 }); // west of stall
    const buffer = [snapshot([stalled, upstream])];

    const projection = predictImpact(geographicIncident(), buffer, 6 * MIN);

    expect(projection).not.toBeNull();
    expect(projection.affected[0].downstreamVehicleIds).toEqual(['sl:bus-2']);
  });

  it('excludes a same-line/direction vehicle that has already passed the stall point', () => {
    // Stalled heading east (bearing 90); candidate sits to the east — ahead of
    // the stall, so it has already passed and is not downstream.
    const stalled = vehicle({ id: 'sl:bus-1', bearing: 90 });
    const ahead = vehicle({ id: 'sl:bus-3', longitude: 18.08 }); // east of stall
    const buffer = [snapshot([stalled, ahead])];

    expect(predictImpact(geographicIncident(), buffer, 6 * MIN)).toBeNull();
  });

  it('excludes a same-line/direction vehicle upstream but beyond the distance cap', () => {
    // West of the stall (behind) but ~3.4 km away — beyond MAX_DOWNSTREAM_DISTANCE_M.
    const stalled = vehicle({ id: 'sl:bus-1', bearing: 90 });
    const farUpstream = vehicle({ id: 'sl:bus-4', longitude: 18.008 });
    const buffer = [snapshot([stalled, farUpstream])];

    expect(predictImpact(geographicIncident(), buffer, 6 * MIN)).toBeNull();
  });

  it('returns null when nothing is selected or the buffer is empty', () => {
    expect(predictImpact(null, [snapshot([vehicle()])], 6 * MIN)).toBeNull();
    expect(predictImpact(geographicIncident(), [], 6 * MIN)).toBeNull();
  });

  // --- Slice 3: coarse delay magnitude from headway/gap growth ---

  // A stationary anomaly as clusterIncidents folds onto the Incident: it carries
  // the measured stall duration that seeds the first-order delay estimate.
  function stationaryAnomaly(overrides = {}) {
    return {
      ruleId: 'stationary-on-active-trip',
      vehicleId: 'sl:bus-1',
      operator: 'sl',
      line: '4',
      measuredStationaryMs: 10 * MIN,
      thresholdMs: 5 * MIN,
      ...overrides,
    };
  }

  it('estimates a ~10 min magnitude for a ten-minute stall with downstream history', () => {
    // Stall measured at ten minutes; the downstream bus is present across two
    // snapshots so headway growth can be measured (here it is stable).
    const stalled = vehicle({ id: 'sl:bus-1' });
    const behind = vehicle({ id: 'sl:bus-2', latitude: 59.31, longitude: 18.06 });
    const buffer = [
      snapshot([stalled, behind], 5 * MIN),
      snapshot([stalled, behind], 6 * MIN),
    ];
    const incident = geographicIncident({ anomalies: [stationaryAnomaly()] });

    const projection = predictImpact(incident, buffer, 6 * MIN);

    expect(projection).not.toBeNull();
    const a = projection.affected[0];
    expect(coarseDelayLabel(a.estimatedDelayMs)).toBe('~10 min');
    // Exposes its inputs so the forecast is auditable (story 7).
    expect(a.measuredStationaryMs).toBe(10 * MIN);
    expect(Number.isFinite(a.headwayBaselineMs)).toBe(true);
    expect(Number.isFinite(a.gapGrowthMs)).toBe(true);
    expect(a.downstreamVehicleIds).toEqual(['sl:bus-2']);
  });

  it('falls back to the stationary duration when there is no headway history', () => {
    // Only one snapshot ⇒ no window to measure headway growth over.
    const stalled = vehicle({ id: 'sl:bus-1' });
    const behind = vehicle({ id: 'sl:bus-2', latitude: 59.31, longitude: 18.06 });
    const buffer = [snapshot([stalled, behind], 6 * MIN)];
    const incident = geographicIncident({ anomalies: [stationaryAnomaly()] });

    const a = predictImpact(incident, buffer, 6 * MIN).affected[0];

    expect(a.estimatedDelayMs).toBe(10 * MIN); // stationary duration alone
    expect(a.headwayBaselineMs).toBeNull();
    expect(a.gapGrowthMs).toBeNull();
  });

  it('refines the estimate upward when the headway gap grows across the window', () => {
    // Downstream bus drifts much further back between polls — a growing gap that
    // exceeds the stall duration, so the estimate is driven by the gap growth.
    const stalled = vehicle({ id: 'sl:bus-1' });
    const near = vehicle({ id: 'sl:bus-2', latitude: 59.329, longitude: 18.066 });
    const far = vehicle({ id: 'sl:bus-2', latitude: 59.304, longitude: 18.06 });
    const buffer = [
      snapshot([stalled, near], 5 * MIN),
      snapshot([stalled, far], 6 * MIN),
    ];
    // A short 3-min stall, but the gap to the vehicle behind has ballooned.
    const incident = geographicIncident({
      anomalies: [stationaryAnomaly({ measuredStationaryMs: 3 * MIN })],
    });

    const a = predictImpact(incident, buffer, 6 * MIN).affected[0];

    expect(a.gapGrowthMs).toBeGreaterThan(0);
    expect(a.estimatedDelayMs).toBe(a.gapGrowthMs); // growth dominates the stall
    expect(a.estimatedDelayMs).toBeGreaterThan(5 * MIN);
  });

  // --- Slice 4: confidence floor — silence below the floor ---

  it('surfaces a confidence at or above the floor for fresh observations with a known direction', () => {
    // Two fresh snapshots of a downstream vehicle on a known direction — enough
    // recent observation to clear the floor.
    const stalled = vehicle({ id: 'sl:bus-1' });
    const behind = vehicle({ id: 'sl:bus-2', latitude: 59.31, longitude: 18.06 });
    const buffer = [
      snapshot([stalled, behind], 5 * MIN),
      snapshot([stalled, behind], 6 * MIN),
    ];

    const projection = predictImpact(geographicIncident(), buffer, 6 * MIN);

    expect(projection).not.toBeNull();
    const a = projection.affected[0];
    expect(a.confidence).toBeGreaterThanOrEqual(CONFIDENCE_FLOOR);
  });

  it('returns null when the single downstream observation is stale (below the floor)', () => {
    // One observation, and it is old relative to `now` — too little, too stale to
    // forecast honestly. Silence over a guess.
    const stalled = vehicle({ id: 'sl:bus-1' });
    const behind = vehicle({ id: 'sl:bus-2', latitude: 59.31, longitude: 18.06 });
    const buffer = [snapshot([stalled, behind], 0)];

    expect(predictImpact(geographicIncident(), buffer, 30 * MIN)).toBeNull();
  });

  describe('coarseDelayLabel buckets magnitude without false precision', () => {
    it.each([
      [3, '~5 min'],
      [7, '~5 min'],
      [9, '~10 min'],
      [14, '10+ min'],
    ])('%i min of delay ⇒ "%s"', (minutes, bucket) => {
      expect(coarseDelayLabel(minutes * MIN)).toBe(bucket);
    });

    it('returns null for an unknown (non-finite) magnitude', () => {
      expect(coarseDelayLabel(null)).toBeNull();
      expect(coarseDelayLabel(undefined)).toBeNull();
    });
  });
});
