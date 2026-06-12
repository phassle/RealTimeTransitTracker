import { describe, it, expect } from 'vitest';
import { clusterIncidents, QUIET_PERIOD_MS } from './incidentClustering';

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

  it('merges nearby anomalies from different vehicles into one Incident covering both vehicles and lines', () => {
    // Two stationary vehicles within the cluster distance (~80 m apart), different lines.
    const a = anomaly({ vehicleId: 'sl:bus-1', line: '4', latitude: 59.3293, longitude: 18.0686 });
    const b = anomaly({ vehicleId: 'sl:bus-2', line: '7', latitude: 59.33, longitude: 18.0686 });
    const incidents = clusterIncidents([], [a, b], 6 * 60 * 1000);

    expect(incidents).toHaveLength(1);
    expect(incidents[0].vehicleIds).toEqual(['sl:bus-1', 'sl:bus-2']);
    expect(incidents[0].lines).toEqual(['4', '7']);
    expect(incidents[0].anomalies).toHaveLength(2);
  });

  describe('quiet-period resolution', () => {
    it('resolves an open Incident whose anomalies have stopped recurring once the quiet period elapses', () => {
      const open = clusterIncidents([], [anomaly({ detectedAt: 6 * 60 * 1000 })], 6 * 60 * 1000);
      expect(open[0].status).toBe('open');

      // No new anomalies; quiet period has elapsed since lastUpdate.
      const later = clusterIncidents(open, [], 6 * 60 * 1000 + QUIET_PERIOD_MS);
      expect(later).toHaveLength(1);
      expect(later[0].status).toBe('resolved');
      expect(later[0].resolvedAt).toBe(6 * 60 * 1000 + QUIET_PERIOD_MS);
    });

    it('keeps an Incident open while anomalies keep recurring inside the quiet period', () => {
      const open = clusterIncidents([], [anomaly({ detectedAt: 6 * 60 * 1000 })], 6 * 60 * 1000);
      // A fresh anomaly arrives well within the quiet period.
      const next = clusterIncidents(open, [anomaly({ detectedAt: 7 * 60 * 1000 })], 7 * 60 * 1000);
      expect(next[0].status).toBe('open');
    });

    it('does not re-resolve or change resolvedAt on an already-resolved Incident', () => {
      const open = clusterIncidents([], [anomaly({ detectedAt: 6 * 60 * 1000 })], 6 * 60 * 1000);
      const resolved = clusterIncidents(open, [], 6 * 60 * 1000 + QUIET_PERIOD_MS);
      const stillResolved = clusterIncidents(resolved, [], 20 * 60 * 1000);
      expect(stillResolved[0].status).toBe('resolved');
      expect(stillResolved[0].resolvedAt).toBe(6 * 60 * 1000 + QUIET_PERIOD_MS);
    });
  });

  describe('operator-subject (feed outage) incidents', () => {
    function outage(overrides = {}) {
      return {
        ruleId: 'feed-fetch-failure',
        subjectKind: 'operator',
        operator: 'sl',
        startedAt: 0,
        detectedAt: 6 * 60 * 1000,
        ...overrides,
      };
    }

    it('creates one open Incident with an operator subject and no ground geometry', () => {
      const incidents = clusterIncidents([], [outage()], 6 * 60 * 1000);
      expect(incidents).toHaveLength(1);
      const inc = incidents[0];
      expect(inc.status).toBe('open');
      expect(inc.subject.kind).toBe('operator');
      expect(inc.subject.operator).toBe('sl');
      expect(inc.subject.latitude).toBeUndefined();
      expect(inc.vehicleIds).toEqual([]);
      expect(inc.id).toBe('feed-outage:sl:0');
      expect(inc.anomalies).toHaveLength(1);
    });

    it('folds repeated and cross-signal anomalies for the same operator into one Incident', () => {
      const first = clusterIncidents([], [outage({ detectedAt: 6 * 60 * 1000 })], 6 * 60 * 1000);
      const second = clusterIncidents(
        first,
        [
          outage({ ruleId: 'feed-fetch-failure', detectedAt: 8 * 60 * 1000 }),
          outage({ ruleId: 'feed-vehicle-collapse', detectedAt: 8 * 60 * 1000 }),
        ],
        8 * 60 * 1000,
      );
      expect(second).toHaveLength(1);
      expect(second[0].anomalies).toHaveLength(3);
      expect(second[0].lastUpdate).toBe(8 * 60 * 1000);
    });

    it('keeps different operators as separate Incidents', () => {
      const incidents = clusterIncidents(
        [],
        [outage({ operator: 'sl' }), outage({ operator: 'ul' })],
        6 * 60 * 1000,
      );
      expect(incidents).toHaveLength(2);
    });

    it('never merges an operator-subject Incident with a nearby geographic anomaly', () => {
      const op = clusterIncidents([], [outage()], 6 * 60 * 1000);
      const mixed = clusterIncidents(op, [anomaly()], 6 * 60 * 1000);
      // the geographic stationary anomaly forms its own Incident
      expect(mixed).toHaveLength(2);
      const kinds = mixed.map((i) => i.subject.kind).sort();
      expect(kinds).toEqual(['geographic', 'operator']);
    });

    it('resolves a quiet operator Incident after the quiet period', () => {
      const open = clusterIncidents([], [outage({ detectedAt: 6 * 60 * 1000 })], 6 * 60 * 1000);
      const later = clusterIncidents(open, [], 6 * 60 * 1000 + QUIET_PERIOD_MS);
      expect(later[0].status).toBe('resolved');
    });
  });

  describe('stale freeze on a blind source', () => {
    function outage(overrides = {}) {
      return {
        ruleId: 'feed-fetch-failure',
        subjectKind: 'operator',
        operator: 'sl',
        startedAt: 0,
        detectedAt: 6 * 60 * 1000,
        ...overrides,
      };
    }

    it('marks a fresh geographic Incident not stale', () => {
      const incidents = clusterIncidents([], [anomaly()], 6 * 60 * 1000);
      expect(incidents[0].stale).toBe(false);
    });

    it('records the operator(s) a geographic Incident is based on', () => {
      const incidents = clusterIncidents([], [anomaly({ operator: 'sl' })], 6 * 60 * 1000);
      expect(incidents[0].operators).toEqual(['sl']);
    });

    it('freezes a geographic Incident (open, stale) when its operator goes blind, rather than auto-resolving', () => {
      const open = clusterIncidents([], [anomaly({ detectedAt: 6 * 60 * 1000 })], 6 * 60 * 1000);
      expect(open[0].status).toBe('open');

      // The operator's feed goes out: an outage anomaly arrives, no fresh stationary
      // anomaly does, and the quiet period has elapsed since the geographic incident's
      // lastUpdate — it would normally resolve now.
      const blindAt = 6 * 60 * 1000 + QUIET_PERIOD_MS;
      const next = clusterIncidents(open, [outage({ detectedAt: blindAt })], blindAt);

      const geo = next.find((i) => i.subject.kind === 'geographic');
      expect(geo.status).toBe('open'); // frozen, not resolved — absence of data is not resolution
      expect(geo.stale).toBe(true);
    });

    it('never auto-resolves while the source stays blind, however long', () => {
      let cur = clusterIncidents([], [anomaly({ detectedAt: 6 * 60 * 1000 })], 6 * 60 * 1000);
      for (const t of [12, 18, 24, 40].map((m) => m * 60 * 1000)) {
        cur = clusterIncidents(cur, [outage({ detectedAt: t })], t);
      }
      const geo = cur.find((i) => i.subject.kind === 'geographic');
      expect(geo.status).toBe('open');
      expect(geo.stale).toBe(true);
    });

    it('clears the stale flag and resumes lifecycle when the feed recovers', () => {
      const open = clusterIncidents([], [anomaly({ detectedAt: 6 * 60 * 1000 })], 6 * 60 * 1000);
      const blindAt = 6 * 60 * 1000 + QUIET_PERIOD_MS;
      const blind = clusterIncidents(open, [outage({ detectedAt: blindAt })], blindAt);
      expect(blind.find((i) => i.subject.kind === 'geographic').stale).toBe(true);

      // Feed recovers: no more outage anomalies. Still no fresh stationary anomaly and
      // the quiet period is long past, so the resumed lifecycle resolves it.
      const recoverAt = blindAt + 1000;
      const recovered = clusterIncidents(blind, [], recoverAt);
      const geo = recovered.find((i) => i.subject.kind === 'geographic');
      expect(geo.stale).toBe(false);
      expect(geo.status).toBe('resolved');
    });

    it('does not freeze a geographic Incident whose own operator is still healthy', () => {
      const open = clusterIncidents(
        [],
        [anomaly({ vehicleId: 'ul:bus-9', operator: 'ul', detectedAt: 6 * 60 * 1000 })],
        6 * 60 * 1000,
      );
      const blindAt = 6 * 60 * 1000 + QUIET_PERIOD_MS;
      // A different operator ('sl') goes blind; our incident belongs to 'ul'.
      const next = clusterIncidents(open, [outage({ operator: 'sl', detectedAt: blindAt })], blindAt);
      const geo = next.find((i) => i.subject.kind === 'geographic');
      expect(geo.status).toBe('resolved'); // ul healthy ⇒ normal lifecycle still applies
      expect(geo.stale).toBe(false);
    });
  });

  describe('recurrence after resolution', () => {
    it('surfaces a new open Incident when a matching anomaly recurs, keeping the resolved one', () => {
      const open = clusterIncidents([], [anomaly({ startedAt: 0, detectedAt: 6 * 60 * 1000 })], 6 * 60 * 1000);
      const resolved = clusterIncidents(open, [], 6 * 60 * 1000 + QUIET_PERIOD_MS);
      expect(resolved[0].status).toBe('resolved');

      // Same vehicle stops again later — a new stationary span (different startedAt).
      const recurAt = 30 * 60 * 1000;
      const recurred = clusterIncidents(
        resolved,
        [anomaly({ startedAt: 25 * 60 * 1000, detectedAt: recurAt })],
        recurAt,
      );

      expect(recurred).toHaveLength(2);
      const open2 = recurred.filter((i) => i.status === 'open');
      const done = recurred.filter((i) => i.status === 'resolved');
      expect(open2).toHaveLength(1);
      expect(done).toHaveLength(1);
      // Distinct ids so both can coexist in the inbox.
      expect(open2[0].id).not.toBe(done[0].id);
    });
  });
});
