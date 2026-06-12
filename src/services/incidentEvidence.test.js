import { describe, it, expect } from 'vitest';
import {
  aggregateEvidence,
  timelineAnomalies,
  anomalyEvidence,
  anomalyKey,
  ruleLabel,
} from './incidentEvidence';

const MIN = 60 * 1000;
const T0 = new Date('2026-06-12T08:42:00Z').getTime();

function stationaryAnomaly(overrides = {}) {
  return {
    ruleId: 'stationary-on-active-trip',
    vehicleId: 'sl:bus-1',
    operator: 'sl',
    line: '4',
    tripId: 'trip-abc',
    latitude: 59.3293,
    longitude: 18.0686,
    measuredStationaryMs: 6 * MIN,
    thresholdMs: 5 * MIN,
    displacementThresholdM: 30,
    startedAt: T0,
    detectedAt: T0 + 6 * MIN,
    ...overrides,
  };
}

function outageAnomaly(overrides = {}) {
  return {
    ruleId: 'feed-fetch-failure',
    subjectKind: 'operator',
    operator: 'sl',
    measuredFailures: 3,
    thresholdFailures: 3,
    startedAt: T0,
    detectedAt: T0 + 6 * MIN,
    ...overrides,
  };
}

describe('incidentEvidence', () => {
  describe('feed-outage rule descriptors', () => {
    it('labels each feed-outage rule and extracts its threshold and measured value', () => {
      const fetchFail = aggregateEvidence({ anomalies: [outageAnomaly()] })[0];
      expect(fetchFail.ruleLabel).toBe(ruleLabel('feed-fetch-failure'));
      expect(fetchFail.ruleLabel).not.toBe('feed-fetch-failure'); // a human label, not the id
      expect(fetchFail.measured).toMatch(/3/);
      expect(fetchFail.threshold).toMatch(/3/);

      const frozen = aggregateEvidence({
        anomalies: [outageAnomaly({ ruleId: 'feed-frozen-timestamps', measuredFrozenMs: 4 * MIN, thresholdMs: 3 * MIN })],
      })[0];
      expect(frozen.measured).toMatch(/min/);
      expect(frozen.threshold).toMatch(/min/);

      const collapse = aggregateEvidence({
        anomalies: [outageAnomaly({ ruleId: 'feed-vehicle-collapse', measuredCount: 3, baselineCount: 100, collapseRatio: 0.2 })],
      })[0];
      expect(collapse.measured).toMatch(/3/);
      expect(collapse.threshold).toMatch(/100/);
    });

    it('gives operator-subject anomalies a stable key that does not collide across rules', () => {
      const a = outageAnomaly({ ruleId: 'feed-fetch-failure' });
      const b = outageAnomaly({ ruleId: 'feed-vehicle-collapse' });
      expect(anomalyKey(a)).not.toBe(anomalyKey(b));
    });
  });

  describe('timelineAnomalies', () => {
    it('orders anomalies chronologically by detectedAt', () => {
      const later = stationaryAnomaly({ detectedAt: T0 + 8 * MIN });
      const earlier = stationaryAnomaly({ detectedAt: T0 + 6 * MIN });
      const ordered = timelineAnomalies({ anomalies: [later, earlier] });
      expect(ordered.map((a) => a.detectedAt)).toEqual([T0 + 6 * MIN, T0 + 8 * MIN]);
    });

    it('returns [] for an incident without anomalies', () => {
      expect(timelineAnomalies(null)).toEqual([]);
      expect(timelineAnomalies({})).toEqual([]);
    });
  });

  describe('aggregateEvidence', () => {
    it('produces one claim per contributing rule with structured evidence', () => {
      const a1 = stationaryAnomaly({ detectedAt: T0 + 6 * MIN, measuredStationaryMs: 6 * MIN });
      const a2 = stationaryAnomaly({ detectedAt: T0 + 8 * MIN, measuredStationaryMs: 8 * MIN });
      const claims = aggregateEvidence({ anomalies: [a1, a2] });

      expect(claims).toHaveLength(1);
      const c = claims[0];
      expect(c.ruleLabel).toBe('Stationary on active trip');
      expect(c.threshold).toBe('5 min');
      // measured value comes from the latest anomaly (largest)
      expect(c.measured).toBe('8 min');
      expect(c.vehicles).toEqual(['sl:bus-1']);
      expect(c.lines).toEqual(['4']);
      expect(c.startedAt).toBe(T0);
    });

    it('aggregates affected vehicles and lines across anomalies, de-duped', () => {
      const a1 = stationaryAnomaly({ vehicleId: 'sl:bus-1', line: '4' });
      const a2 = stationaryAnomaly({ vehicleId: 'sl:bus-2', line: '7', detectedAt: T0 + 7 * MIN });
      const a3 = stationaryAnomaly({ vehicleId: 'sl:bus-1', line: '4', detectedAt: T0 + 8 * MIN });
      const claims = aggregateEvidence({ anomalies: [a1, a2, a3] });
      expect(claims[0].vehicles).toEqual(['sl:bus-1', 'sl:bus-2']);
      expect(claims[0].lines).toEqual(['4', '7']);
    });

    it('every claim references an existing anomaly on the timeline (no orphans)', () => {
      const a1 = stationaryAnomaly({ detectedAt: T0 + 6 * MIN });
      const a2 = stationaryAnomaly({ detectedAt: T0 + 8 * MIN });
      const incident = { anomalies: [a1, a2] };
      const claims = aggregateEvidence(incident);
      const keys = new Set(timelineAnomalies(incident).map(anomalyKey));
      for (const claim of claims) {
        expect(keys.has(claim.anomalyKey)).toBe(true);
      }
    });

    it('returns [] for an incident with no anomalies', () => {
      expect(aggregateEvidence({ anomalies: [] })).toEqual([]);
    });
  });

  describe('anomalyEvidence', () => {
    it('extracts a per-anomaly evidence row', () => {
      const ev = anomalyEvidence(stationaryAnomaly());
      expect(ev.ruleLabel).toBe('Stationary on active trip');
      expect(ev.measured).toBe('6 min');
      expect(ev.vehicleId).toBe('sl:bus-1');
      expect(ev.line).toBe('4');
      expect(ev.key).toBe(anomalyKey(stationaryAnomaly()));
    });
  });

  describe('ruleLabel', () => {
    it('falls back to the rule id for unknown rules', () => {
      expect(ruleLabel('some-future-rule')).toBe('some-future-rule');
    });
  });
});
