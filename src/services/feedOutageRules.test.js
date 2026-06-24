import { describe, it, expect } from 'vitest';
import {
  detectFeedOutageAnomalies,
  FETCH_FAILURE_STREAK,
  FROZEN_FEED_MS,
  VEHICLE_COLLAPSE_RATIO,
  VEHICLE_COLLAPSE_MIN_BASELINE,
} from './feedOutageRules';

const MIN = 60 * 1000;

// Build a per-poll snapshot carrying per-operator feed outcomes.
function snap(time, feeds) {
  return { time, vehicles: [], feeds };
}

function feed(overrides = {}) {
  return { operator: 'sl', ok: true, vehicleCount: 50, dataTimestamp: 1000, ...overrides };
}

describe('detectFeedOutageAnomalies', () => {
  it('returns nothing for a healthy, advancing, well-populated feed', () => {
    const snaps = [
      snap(0, [feed({ vehicleCount: 50, dataTimestamp: 1000 })]),
      snap(1 * MIN, [feed({ vehicleCount: 51, dataTimestamp: 2000 })]),
      snap(2 * MIN, [feed({ vehicleCount: 49, dataTimestamp: 3000 })]),
    ];
    expect(detectFeedOutageAnomalies(snaps, 2 * MIN)).toEqual([]);
  });

  it('returns nothing for an empty buffer', () => {
    expect(detectFeedOutageAnomalies([], 0)).toEqual([]);
  });

  // Issue #169 — airplanes.live is never a Watched operator or Feed-outage
  // subject. Aircraft come from a separate hook whose outcomes never enter the
  // transit feed series, so airplanes.live never appears in snapshot.feeds and
  // can never be the subject of an outage Anomaly — even with aircraft Vehicles
  // present in the snapshot's vehicle list (which this rule ignores entirely).
  it('never raises an airplanes.live-subject outage even with aircraft on the map', () => {
    const aircraftVehicle = { id: 'air:4ca7b2', mode: 'helicopter', line: 'POL01' };
    const snaps = [
      { time: 0, vehicles: [aircraftVehicle], feeds: [feed({ ok: true })] },
      { time: 1 * MIN, vehicles: [aircraftVehicle], feeds: [feed({ ok: false, vehicleCount: 0, dataTimestamp: null })] },
      { time: 2 * MIN, vehicles: [aircraftVehicle], feeds: [feed({ ok: false, vehicleCount: 0, dataTimestamp: null })] },
      { time: 3 * MIN, vehicles: [aircraftVehicle], feeds: [feed({ ok: false, vehicleCount: 0, dataTimestamp: null })] },
    ];
    const anomalies = detectFeedOutageAnomalies(snaps, 3 * MIN);

    // The transit operator may flag (it failed), but airplanes.live never does.
    expect(anomalies.every((a) => a.operator !== 'airplanes.live')).toBe(true);
    expect(anomalies.map((a) => a.operator)).not.toContain('air');
  });

  describe('signal: repeated fetch failures', () => {
    it('raises a feed-fetch-failure anomaly after a streak of failed fetches', () => {
      const snaps = [
        snap(0, [feed({ ok: true })]),
        snap(1 * MIN, [feed({ ok: false, vehicleCount: 0, dataTimestamp: null })]),
        snap(2 * MIN, [feed({ ok: false, vehicleCount: 0, dataTimestamp: null })]),
        snap(3 * MIN, [feed({ ok: false, vehicleCount: 0, dataTimestamp: null })]),
      ];
      const anomalies = detectFeedOutageAnomalies(snaps, 3 * MIN);
      const a = anomalies.find((x) => x.ruleId === 'feed-fetch-failure');
      expect(a).toBeDefined();
      expect(a.subjectKind).toBe('operator');
      expect(a.operator).toBe('sl');
      expect(a.measuredFailures).toBe(FETCH_FAILURE_STREAK);
      expect(a.thresholdFailures).toBe(FETCH_FAILURE_STREAK);
      expect(a.startedAt).toBe(1 * MIN); // first failure in the streak
      expect(a.detectedAt).toBe(3 * MIN);
      expect(a.vehicleId).toBeUndefined(); // no ground geometry
      expect(a.latitude).toBeUndefined();
    });

    it('does not raise below the failure streak threshold', () => {
      const snaps = [
        snap(0, [feed({ ok: true })]),
        snap(1 * MIN, [feed({ ok: false, vehicleCount: 0, dataTimestamp: null })]),
        snap(2 * MIN, [feed({ ok: false, vehicleCount: 0, dataTimestamp: null })]),
      ];
      expect(detectFeedOutageAnomalies(snaps, 2 * MIN).filter((a) => a.ruleId === 'feed-fetch-failure')).toEqual([]);
    });

    it('a recovered fetch resets the streak', () => {
      const snaps = [
        snap(0, [feed({ ok: false })]),
        snap(1 * MIN, [feed({ ok: false })]),
        snap(2 * MIN, [feed({ ok: true })]), // recovered → latest is healthy
      ];
      expect(detectFeedOutageAnomalies(snaps, 2 * MIN).filter((a) => a.ruleId === 'feed-fetch-failure')).toEqual([]);
    });
  });

  describe('signal: data timestamps stopped advancing', () => {
    it('raises a feed-frozen-timestamps anomaly when a responding feed stops advancing', () => {
      const snaps = [
        snap(0, [feed({ ok: true, dataTimestamp: 5000 })]),
        snap(2 * MIN, [feed({ ok: true, dataTimestamp: 5000 })]),
        snap(4 * MIN, [feed({ ok: true, dataTimestamp: 5000 })]),
      ];
      const a = detectFeedOutageAnomalies(snaps, 4 * MIN).find((x) => x.ruleId === 'feed-frozen-timestamps');
      expect(a).toBeDefined();
      expect(a.subjectKind).toBe('operator');
      expect(a.operator).toBe('sl');
      expect(a.startedAt).toBe(0); // first snapshot carrying the frozen timestamp
      expect(a.measuredFrozenMs).toBe(4 * MIN);
      expect(a.thresholdMs).toBe(FROZEN_FEED_MS);
      expect(a.frozenDataTimestamp).toBe(5000);
    });

    it('does not raise while the timestamp keeps advancing', () => {
      const snaps = [
        snap(0, [feed({ dataTimestamp: 1000 })]),
        snap(2 * MIN, [feed({ dataTimestamp: 2000 })]),
        snap(4 * MIN, [feed({ dataTimestamp: 3000 })]),
      ];
      expect(detectFeedOutageAnomalies(snaps, 4 * MIN).filter((a) => a.ruleId === 'feed-frozen-timestamps')).toEqual([]);
    });

    it('does not raise before the frozen threshold elapses', () => {
      const snaps = [
        snap(0, [feed({ dataTimestamp: 5000 })]),
        snap(1 * MIN, [feed({ dataTimestamp: 5000 })]),
      ];
      expect(detectFeedOutageAnomalies(snaps, 1 * MIN).filter((a) => a.ruleId === 'feed-frozen-timestamps')).toEqual([]);
    });
  });

  describe('signal: sudden vehicle-count collapse', () => {
    it('raises a feed-vehicle-collapse anomaly when the count collapses against the recent baseline', () => {
      const snaps = [
        snap(0, [feed({ vehicleCount: 100, dataTimestamp: 1000 })]),
        snap(1 * MIN, [feed({ vehicleCount: 98, dataTimestamp: 2000 })]),
        snap(2 * MIN, [feed({ vehicleCount: 3, dataTimestamp: 3000 })]),
      ];
      const a = detectFeedOutageAnomalies(snaps, 2 * MIN).find((x) => x.ruleId === 'feed-vehicle-collapse');
      expect(a).toBeDefined();
      expect(a.subjectKind).toBe('operator');
      expect(a.operator).toBe('sl');
      expect(a.measuredCount).toBe(3);
      expect(a.baselineCount).toBe(100);
      expect(a.collapseRatio).toBe(VEHICLE_COLLAPSE_RATIO);
    });

    it('does not raise for a small fluctuation', () => {
      const snaps = [
        snap(0, [feed({ vehicleCount: 100 })]),
        snap(1 * MIN, [feed({ vehicleCount: 90 })]),
      ];
      expect(detectFeedOutageAnomalies(snaps, 1 * MIN).filter((a) => a.ruleId === 'feed-vehicle-collapse')).toEqual([]);
    });

    it('does not raise when the baseline is too small to be meaningful', () => {
      const baseline = VEHICLE_COLLAPSE_MIN_BASELINE - 1;
      const snaps = [
        snap(0, [feed({ vehicleCount: baseline })]),
        snap(1 * MIN, [feed({ vehicleCount: 0 })]),
      ];
      expect(detectFeedOutageAnomalies(snaps, 1 * MIN).filter((a) => a.ruleId === 'feed-vehicle-collapse')).toEqual([]);
    });
  });

  describe('watched status', () => {
    it('only considers operators present in the latest snapshot (watched)', () => {
      // 'ul' failed in an earlier poll but is no longer polled (unwatched now).
      const snaps = [
        snap(0, [feed({ operator: 'sl' }), feed({ operator: 'ul', ok: false })]),
        snap(1 * MIN, [feed({ operator: 'ul', ok: false })]),
        snap(2 * MIN, [feed({ operator: 'sl' })]), // only sl watched now
      ];
      const anomalies = detectFeedOutageAnomalies(snaps, 2 * MIN);
      expect(anomalies.some((a) => a.operator === 'ul')).toBe(false);
    });

    it('preserves watched-operator order and first feed outcome per snapshot', () => {
      const snaps = [
        snap(0, [
          feed({ operator: 'ul', ok: false }),
          feed({ operator: 'ul', ok: true }),
          feed({ operator: 'sl', ok: false }),
          feed({ operator: 'sl', ok: true }),
        ]),
        snap(1 * MIN, [
          feed({ operator: 'ul', ok: false }),
          feed({ operator: 'sl', ok: false }),
        ]),
        snap(2 * MIN, [
          feed({ operator: 'ul', ok: false }),
          feed({ operator: 'sl', ok: false }),
        ]),
      ];

      expect(detectFeedOutageAnomalies(snaps, 2 * MIN).map((a) => a.operator)).toEqual(['ul', 'sl']);
    });
  });
});
