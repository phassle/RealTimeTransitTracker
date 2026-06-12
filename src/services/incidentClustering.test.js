import { describe, it, expect } from 'vitest';
import { clusterIncidents } from './incidentClustering';

function anomaly(overrides = {}) {
  return {
    ruleId: 'stationary-on-active-trip',
    vehicleId: 'sl:bus-1',
    operator: 'sl',
    line: '4',
    tripId: 'trip-abc',
    latitude: 59.3293,
    longitude: 18.0686,
    startedAt: 0,
    detectedAt: 6 * 60 * 1000,
    ...overrides,
  };
}

describe('clusterIncidents', () => {
  it('creates one open Incident with a geographic subject from a new anomaly', () => {
    const incidents = clusterIncidents([], [anomaly()], 6 * 60 * 1000);

    expect(incidents).toHaveLength(1);
    const inc = incidents[0];
    expect(inc.status).toBe('open');
    expect(inc.subject.kind).toBe('geographic');
    expect(inc.subject.latitude).toBe(59.3293);
    expect(inc.lines).toEqual(['4']);
    expect(inc.vehicleIds).toEqual(['sl:bus-1']);
    expect(inc.startedAt).toBe(0);
    expect(inc.anomalies).toHaveLength(1);
  });

  it('folds a repeat detection of the same vehicle into the same Incident', () => {
    const first = clusterIncidents([], [anomaly({ detectedAt: 6 * 60 * 1000 })], 6 * 60 * 1000);
    const second = clusterIncidents(
      first,
      [anomaly({ detectedAt: 8 * 60 * 1000 })],
      8 * 60 * 1000,
    );

    expect(second).toHaveLength(1);
    expect(second[0].anomalies).toHaveLength(2); // each detection on the timeline
    expect(second[0].startedAt).toBe(0); // original start preserved
    expect(second[0].lastUpdate).toBe(8 * 60 * 1000);
    expect(second[0].vehicleIds).toEqual(['sl:bus-1']); // still one vehicle
  });

  it('does not mutate the existing incidents passed in', () => {
    const first = clusterIncidents([], [anomaly()], 6 * 60 * 1000);
    const snapshotAnomalyCount = first[0].anomalies.length;
    clusterIncidents(first, [anomaly({ detectedAt: 8 * 60 * 1000 })], 8 * 60 * 1000);
    expect(first[0].anomalies.length).toBe(snapshotAnomalyCount); // unchanged
  });

  it('keeps distinct far-apart vehicles as separate Incidents', () => {
    const a = anomaly({ vehicleId: 'sl:bus-1', latitude: 59.3293, longitude: 18.0686 });
    const b = anomaly({ vehicleId: 'sl:bus-2', latitude: 57.7, longitude: 11.97 }); // Gothenburg
    const incidents = clusterIncidents([], [a, b], 6 * 60 * 1000);
    expect(incidents).toHaveLength(2);
  });
});
