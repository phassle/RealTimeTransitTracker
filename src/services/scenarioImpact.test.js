import { describe, it, expect } from 'vitest';
import { computeScenarioImpact, buildPresetScenario, SLUSSEN_AREA } from './scenarioImpact';

const MIN = 60 * 1000;

// Fixture builders, mirroring the behaviour-only style of etaProjection.test.js
// / incidentClustering.test.js: synthetic vehicles + snapshots, no mocks, no I/O.
function vehicle(overrides = {}) {
  return {
    id: 'sl:bus-1',
    operator: 'sl',
    line: '4',
    latitude: 59.32,
    longitude: 18.071,
    ...overrides,
  };
}

function snapshot(vehicles, time = 6 * MIN) {
  return { time, vehicles };
}

// A small box around central Slussen, matching SLUSSEN_AREA's shape.
const AREA = { south: 59.317, west: 18.065, north: 59.323, east: 18.078 };

function scenario(overrides = {}) {
  return {
    id: 'scenario:slussen',
    name: 'close Slussen',
    source: 'preset',
    demo: true,
    area: AREA,
    ...overrides,
  };
}

describe('computeScenarioImpact', () => {
  it('includes a vehicle whose latest position is inside the box', () => {
    const inside = vehicle({ id: 'sl:bus-1', line: '2', latitude: 59.32, longitude: 18.071 });
    const buffer = [snapshot([inside])];

    const impact = computeScenarioImpact(scenario(), buffer, 6 * MIN);

    expect(impact.inAreaVehicleIds).toEqual(['sl:bus-1']);
    expect(impact.lines).toEqual([{ line: '2', operator: 'sl' }]);
    expect(impact.operators).toEqual(['sl']);
  });

  it('excludes a vehicle whose latest position is outside the box', () => {
    const outside = vehicle({ id: 'sl:bus-9', latitude: 59.40, longitude: 18.20 });
    const buffer = [snapshot([outside])];

    const impact = computeScenarioImpact(scenario(), buffer, 6 * MIN);

    expect(impact.inAreaVehicleIds).toEqual([]);
    expect(impact.lines).toEqual([]);
    expect(impact.operators).toEqual([]);
  });

  it('reads the latest snapshot: a vehicle that has left the box by the last poll is excluded', () => {
    const early = snapshot([vehicle({ id: 'sl:bus-1', latitude: 59.32, longitude: 18.071 })], 1 * MIN);
    const late = snapshot([vehicle({ id: 'sl:bus-1', latitude: 59.40, longitude: 18.20 })], 6 * MIN);

    const impact = computeScenarioImpact(scenario(), [early, late], 6 * MIN);

    expect(impact.inAreaVehicleIds).toEqual([]);
  });

  it('aggregates affected lines and operators across multiple operators', () => {
    const a = vehicle({ id: 'sl:bus-1', operator: 'sl', line: '2', latitude: 59.319, longitude: 18.07 });
    const b = vehicle({ id: 'sl:bus-2', operator: 'sl', line: '4', latitude: 59.32, longitude: 18.072 });
    const c = vehicle({ id: 'ul:bus-3', operator: 'ul', line: '801', latitude: 59.318, longitude: 18.069 });
    const buffer = [snapshot([a, b, c])];

    const impact = computeScenarioImpact(scenario(), buffer, 6 * MIN);

    expect(impact.inAreaVehicleIds).toEqual(['sl:bus-1', 'sl:bus-2', 'ul:bus-3']);
    expect(impact.lines).toEqual([
      { line: '2', operator: 'sl' },
      { line: '4', operator: 'sl' },
      { line: '801', operator: 'ul' },
    ]);
    expect(impact.operators).toEqual(['sl', 'ul']);
  });

  it('dedupes a line/operator pair seen on two vehicles', () => {
    const a = vehicle({ id: 'sl:bus-1', operator: 'sl', line: '2', latitude: 59.319, longitude: 18.07 });
    const b = vehicle({ id: 'sl:bus-2', operator: 'sl', line: '2', latitude: 59.32, longitude: 18.072 });
    const buffer = [snapshot([a, b])];

    const impact = computeScenarioImpact(scenario(), buffer, 6 * MIN);

    expect(impact.inAreaVehicleIds).toEqual(['sl:bus-1', 'sl:bus-2']);
    expect(impact.lines).toEqual([{ line: '2', operator: 'sl' }]);
    expect(impact.operators).toEqual(['sl']);
  });

  it('empty buffer yields an empty impact without error', () => {
    const impact = computeScenarioImpact(scenario(), [], 6 * MIN);
    expect(impact).toEqual({ lines: [], operators: [], inAreaVehicleIds: [] });
  });

  it('a box with no vehicles inside yields an empty impact without error', () => {
    const outside = vehicle({ id: 'sl:bus-9', latitude: 59.40, longitude: 18.20 });
    const impact = computeScenarioImpact(scenario(), [snapshot([outside])], 6 * MIN);
    expect(impact).toEqual({ lines: [], operators: [], inAreaVehicleIds: [] });
  });

  it('tolerates the observation buffer object, not just a snapshots array', () => {
    const inside = vehicle({ id: 'sl:bus-1', line: '2' });
    const buffer = { snapshots: () => [snapshot([inside])] };

    const impact = computeScenarioImpact(scenario(), buffer, 6 * MIN);

    expect(impact.inAreaVehicleIds).toEqual(['sl:bus-1']);
  });
});

describe('buildPresetScenario', () => {
  it('builds the "close Slussen" preset marked as demo content', () => {
    const s = buildPresetScenario('slussen-1');
    expect(s.id).toBe('slussen-1');
    expect(s.name).toBe('close Slussen');
    expect(s.source).toBe('preset');
    expect(s.demo).toBe(true);
    expect(s.area).toEqual(SLUSSEN_AREA);
  });
});
