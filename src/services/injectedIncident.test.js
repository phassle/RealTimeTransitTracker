import { describe, it, expect } from 'vitest';
import { buildInjectedAnomalies } from './injectedIncident';
import { clusterIncidents } from './incidentClustering';

const MIN = 60 * 1000;

describe('buildInjectedAnomalies', () => {
  it('produces stationary anomalies all carrying the demo marker', () => {
    const anomalies = buildInjectedAnomalies(10 * MIN);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies.every((a) => a.demo === true)).toBe(true);
    expect(anomalies.every((a) => a.ruleId === 'stationary-on-active-trip')).toBe(true);
  });

  it('carries full geographic evidence so the real pipeline can render it', () => {
    const a = buildInjectedAnomalies(10 * MIN)[0];
    expect(typeof a.latitude).toBe('number');
    expect(typeof a.longitude).toBe('number');
    expect(a.vehicleId).toBeTruthy();
    expect(a.line).toBeTruthy();
    expect(a.measuredStationaryMs).toBeGreaterThan(a.thresholdMs);
    expect(a.detectedAt).toBe(10 * MIN);
  });

  it('clusters into a single demo Incident with a geographic subject', () => {
    const incidents = clusterIncidents([], buildInjectedAnomalies(10 * MIN), 10 * MIN);
    expect(incidents).toHaveLength(1);
    expect(incidents[0].demo).toBe(true);
    expect(incidents[0].subject.kind).toBe('geographic');
    expect(incidents[0].vehicleIds.length).toBeGreaterThan(0);
  });
});
