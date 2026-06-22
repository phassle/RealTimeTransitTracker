import { describe, it, expect } from 'vitest';
import { predictImpact } from './etaProjection';

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
});
