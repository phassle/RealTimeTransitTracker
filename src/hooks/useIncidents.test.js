import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIncidents } from './useIncidents';

const MIN = 60 * 1000;

// A controllable clock; each poll passes a fresh vehicles array so the
// hook's effect (keyed on the vehicles reference) re-runs.
function stuck() {
  return [
    { id: 'sl:bus-1', operator: 'sl', line: '4', tripId: 'trip-abc', latitude: 59.3293, longitude: 18.0686 },
  ];
}

describe('useIncidents', () => {
  it('no incidents before the stationary threshold is crossed', () => {
    let t = 0;
    const now = () => t;
    const { result, rerender } = renderHook(({ v }) => useIncidents(v, { now }), {
      initialProps: { v: stuck() },
    });
    expect(result.current.incidents).toHaveLength(0);

    act(() => { t = 2 * MIN; });
    rerender({ v: stuck() });
    expect(result.current.incidents).toHaveLength(0);
  });

  it('raises one Incident once the vehicle has been stationary past the threshold', () => {
    let t = 0;
    const now = () => t;
    const { result, rerender } = renderHook(({ v }) => useIncidents(v, { now }), {
      initialProps: { v: stuck() },
    });

    act(() => { t = 6 * MIN; });
    rerender({ v: stuck() });

    expect(result.current.incidents).toHaveLength(1);
    expect(result.current.incidents[0].lines).toEqual(['4']);
    expect(result.current.incidents[0].vehicleIds).toEqual(['sl:bus-1']);
  });

  it('folds subsequent detections into the same single Incident', () => {
    let t = 0;
    const now = () => t;
    const { result, rerender } = renderHook(({ v }) => useIncidents(v, { now }), {
      initialProps: { v: stuck() },
    });

    act(() => { t = 6 * MIN; });
    rerender({ v: stuck() });
    act(() => { t = 8 * MIN; });
    rerender({ v: stuck() });

    expect(result.current.incidents).toHaveLength(1);
    expect(result.current.incidents[0].anomalies.length).toBeGreaterThanOrEqual(2);
  });

  // A vehicle that moves each poll, so the replayed snapshot differs from live.
  function movingAt(lng) {
    return [{ id: 'sl:bus-1', operator: 'sl', line: '4', tripId: 'trip-abc', latitude: 59.3, longitude: lng }];
  }

  describe('replay', () => {
    it('is live by default — displayedVehicles is the live vehicles', () => {
      let t = 0;
      const now = () => t;
      const { result } = renderHook(({ v }) => useIncidents(v, { now }), {
        initialProps: { v: movingAt(18.0) },
      });
      expect(result.current.replay.isReplaying).toBe(false);
      expect(result.current.replay.viewedTime).toBeNull();
      expect(result.current.displayedVehicles).toEqual(movingAt(18.0));
    });

    it('scrubbing to a past moment renders that moment and marks past mode', () => {
      let t = 0;
      const now = () => t;
      const { result, rerender } = renderHook(({ v }) => useIncidents(v, { now }), {
        initialProps: { v: movingAt(18.0) },
      });
      act(() => { t = 1 * MIN; });
      rerender({ v: movingAt(18.5) });
      act(() => { t = 2 * MIN; });
      rerender({ v: movingAt(19.0) });

      act(() => { result.current.replay.scrubTo(1 * MIN); });

      expect(result.current.replay.isReplaying).toBe(true);
      expect(result.current.replay.viewedTime).toBe(1 * MIN);
      expect(result.current.displayedVehicles).toEqual(movingAt(18.5));
    });

    it('returnToLive restores current positions and clears past mode', () => {
      let t = 0;
      const now = () => t;
      const { result, rerender } = renderHook(({ v }) => useIncidents(v, { now }), {
        initialProps: { v: movingAt(18.0) },
      });
      act(() => { t = 1 * MIN; });
      rerender({ v: movingAt(19.0) });
      act(() => { result.current.replay.scrubTo(0); });
      expect(result.current.displayedVehicles).toEqual(movingAt(18.0));

      act(() => { result.current.replay.returnToLive(); });
      expect(result.current.replay.isReplaying).toBe(false);
      expect(result.current.displayedVehicles).toEqual(movingAt(19.0));
    });

    it('clamps a scrub before session start to session start', () => {
      let t = 5 * MIN;
      const now = () => t;
      const { result, rerender } = renderHook(({ v }) => useIncidents(v, { now }), {
        initialProps: { v: movingAt(18.0) },
      });
      act(() => { t = 6 * MIN; });
      rerender({ v: movingAt(19.0) });

      expect(result.current.replay.sessionStart).toBe(5 * MIN);

      act(() => { result.current.replay.scrubTo(0); });
      // bounded at session start; renders the earliest snapshot, not before
      expect(result.current.replay.viewedTime).toBe(5 * MIN);
      expect(result.current.displayedVehicles).toEqual(movingAt(18.0));
    });

    it('keeps filling the buffer while replaying — sessionEnd advances', () => {
      let t = 0;
      const now = () => t;
      const { result, rerender } = renderHook(({ v }) => useIncidents(v, { now }), {
        initialProps: { v: movingAt(18.0) },
      });
      act(() => { result.current.replay.scrubTo(0); });
      act(() => { t = 3 * MIN; });
      rerender({ v: movingAt(20.0) });

      expect(result.current.replay.isReplaying).toBe(true);
      expect(result.current.replay.sessionEnd).toBe(3 * MIN);
      // still showing the replayed past, not the new live data
      expect(result.current.displayedVehicles).toEqual(movingAt(18.0));
    });
  });

  describe('feed outage + watched status', () => {
    const okFeeds = () => [{ operator: 'sl', ok: true, vehicleCount: 50, dataTimestamp: 1000 }];
    const failFeeds = () => [{ operator: 'sl', ok: false, vehicleCount: 0, dataTimestamp: null }];

    it('raises an operator-subject Feed outage Incident from repeated fetch failures', () => {
      let t = 0;
      const now = () => t;
      const { result, rerender } = renderHook(
        ({ v, feeds }) => useIncidents(v, { now, feeds }),
        { initialProps: { v: [], feeds: okFeeds() } },
      );
      for (let i = 1; i <= 3; i++) {
        act(() => { t = i * MIN; });
        rerender({ v: [], feeds: failFeeds() });
      }

      const inc = result.current.incidents.find((i) => i.subject.kind === 'operator');
      expect(inc).toBeDefined();
      expect(inc.subject.operator).toBe('sl');
      expect(inc.vehicleIds).toEqual([]); // a data problem, no ground geometry
    });

    it('exposes watched/not-watched status; unwatched operators are never down', () => {
      let t = 0;
      const now = () => t;
      const { result, rerender } = renderHook(
        ({ v, feeds }) => useIncidents(v, { now, feeds }),
        { initialProps: { v: [], feeds: okFeeds() } },
      );
      act(() => { t = 1 * MIN; });
      rerender({ v: [], feeds: okFeeds() });

      const by = Object.fromEntries(result.current.feedStatuses.map((s) => [s.operator, s]));
      expect(by.sl.watched).toBe(true);
      expect(by.skane.watched).toBe(false);
      expect(by.skane.healthy).toBeNull();
    });

    it('focuses an operator-subject Incident on the operator region, not a traffic point', () => {
      let t = 0;
      const now = () => t;
      const { result, rerender } = renderHook(
        ({ v, feeds }) => useIncidents(v, { now, feeds }),
        { initialProps: { v: [], feeds: okFeeds() } },
      );
      for (let i = 1; i <= 3; i++) {
        act(() => { t = i * MIN; });
        rerender({ v: [], feeds: failFeeds() });
      }
      const inc = result.current.incidents.find((i) => i.subject.kind === 'operator');
      act(() => { result.current.selectIncident(inc.id); });

      expect(result.current.focus.isDataProblem).toBe(true);
      expect(result.current.focus.vehicleIds).toEqual([]);
      expect(result.current.focus.center).toEqual([59.33, 18.07]); // SL region centre
    });
  });

  describe('recording export/import', () => {
    it('round-trips: exported window is replayable after import into a fresh session', () => {
      // Capture a moving vehicle across two polls, then export.
      let t = 0;
      const now = () => t;
      const source = renderHook(({ v }) => useIncidents(v, { now }), {
        initialProps: { v: movingAt(18.0) },
      });
      act(() => { t = 1 * MIN; });
      source.rerender({ v: movingAt(18.5) });

      const file = JSON.stringify(source.result.current.recording.export());

      // A brand-new session with unrelated live data imports the file.
      let t2 = 10 * MIN;
      const now2 = () => t2;
      const fresh = renderHook(({ v }) => useIncidents(v, { now: now2 }), {
        initialProps: { v: movingAt(99.0) },
      });

      act(() => { fresh.result.current.recording.import(file); });

      // Replay can scrub the captured window and the positions match capture.
      expect(fresh.result.current.replay.sessionStart).toBe(0);
      expect(fresh.result.current.replay.sessionEnd).toBe(1 * MIN);

      act(() => { fresh.result.current.replay.scrubTo(0); });
      expect(fresh.result.current.displayedVehicles).toEqual(movingAt(18.0));
      act(() => { fresh.result.current.replay.scrubTo(1 * MIN); });
      expect(fresh.result.current.displayedVehicles).toEqual(movingAt(18.5));
    });

    it('a malformed import is refused and leaves the live buffer and incidents intact', () => {
      let t = 0;
      const now = () => t;
      const { result, rerender } = renderHook(({ v }) => useIncidents(v, { now }), {
        initialProps: { v: stuck() },
      });
      // Build up a live incident.
      act(() => { t = 6 * MIN; });
      rerender({ v: stuck() });
      expect(result.current.incidents).toHaveLength(1);
      const liveEnd = result.current.replay.sessionEnd;

      let error = null;
      act(() => {
        try { result.current.recording.import('garbage not a recording'); }
        catch (e) { error = e; }
      });

      expect(error).toBeTruthy();
      expect(error.message).toMatch(/recording/i);
      // Unaffected: incidents and session window stand.
      expect(result.current.incidents).toHaveLength(1);
      expect(result.current.replay.sessionEnd).toBe(liveEnd);
    });
  });

  describe('injected (demo) incidents', () => {
    it('injectIncident adds a demo-marked Incident through the real clustering seam', () => {
      let t = 10 * MIN;
      const now = () => t;
      const { result } = renderHook(({ v }) => useIncidents(v, { now }), {
        initialProps: { v: [] },
      });
      expect(result.current.incidents).toHaveLength(0);

      act(() => { result.current.injectIncident(); });

      const injected = result.current.incidents.filter((i) => i.demo);
      expect(injected).toHaveLength(1);
      expect(injected[0].subject.kind).toBe('geographic');
      // Real evidence flows through: vehicles, lines, anomalies all present.
      expect(injected[0].vehicleIds.length).toBeGreaterThan(0);
      expect(injected[0].anomalies.length).toBeGreaterThan(0);
    });

    it('keeps live, non-injected incidents real alongside an injected one', () => {
      let t = 0;
      const now = () => t;
      const { result, rerender } = renderHook(({ v }) => useIncidents(v, { now }), {
        initialProps: { v: stuck() },
      });
      act(() => { t = 6 * MIN; });
      rerender({ v: stuck() });
      act(() => { result.current.injectIncident(); });

      const real = result.current.incidents.filter((i) => !i.demo);
      const demo = result.current.incidents.filter((i) => i.demo);
      expect(real).toHaveLength(1);
      expect(demo).toHaveLength(1);
    });
  });

  describe('expected impact projection (transient, selected incident only)', () => {
    // A stalled bus plus a downstream bus on the same line+direction; the
    // downstream bus is far enough away to form no incident of its own.
    const stalledPlusDownstream = (stalledLng = 18.0686) => [
      { id: 'sl:bus-1', operator: 'sl', line: '4', direction: '0', tripId: 'trip-abc', latitude: 59.3293, longitude: stalledLng },
      { id: 'sl:bus-2', operator: 'sl', line: '4', direction: '0', tripId: 'trip-def', latitude: 59.31, longitude: 18.06 },
    ];

    it('exposes a projection on the selected geographic incident naming the line, direction and downstream vehicles', () => {
      let t = 0;
      const now = () => t;
      const { result, rerender } = renderHook(({ v }) => useIncidents(v, { now }), {
        initialProps: { v: stalledPlusDownstream() },
      });
      act(() => { t = 6 * MIN; });
      rerender({ v: stalledPlusDownstream() });

      const inc = result.current.incidents.find((i) => i.vehicleIds.includes('sl:bus-1'));
      act(() => { result.current.selectIncident(inc.id); });

      const proj = result.current.selectedIncident.projection;
      expect(proj).not.toBeNull();
      expect(proj.affected).toHaveLength(1);
      expect(proj.affected[0].line).toBe('4');
      expect(proj.affected[0].direction).toBe('0');
      expect(proj.affected[0].downstreamVehicleIds).toContain('sl:bus-2');
    });

    it('retracts the projection on the poll where the stall clears, leaving no incident/timeline trace', () => {
      let t = 0;
      const now = () => t;
      const { result, rerender } = renderHook(({ v }) => useIncidents(v, { now }), {
        initialProps: { v: stalledPlusDownstream() },
      });
      act(() => { t = 6 * MIN; });
      rerender({ v: stalledPlusDownstream() });
      const inc = result.current.incidents.find((i) => i.vehicleIds.includes('sl:bus-1'));
      act(() => { result.current.selectIncident(inc.id); });
      expect(result.current.selectedIncident.projection).not.toBeNull();
      const anomalyCountBefore = result.current.selectedIncident.anomalies.length;

      // Next poll: bus-1 has driven well away from the stall point.
      act(() => { t = 7 * MIN; });
      rerender({ v: stalledPlusDownstream(18.2) });

      expect(result.current.selectedIncident.projection).toBeNull();
      // The forecast never created or touched timeline entries.
      expect(result.current.selectedIncident.anomalies.length).toBe(anomalyCountBefore);
    });

    it('exposes no projection for an operator-subject (feed outage) incident', () => {
      const okFeeds = () => [{ operator: 'sl', ok: true, vehicleCount: 50, dataTimestamp: 1000 }];
      const failFeeds = () => [{ operator: 'sl', ok: false, vehicleCount: 0, dataTimestamp: null }];
      let t = 0;
      const now = () => t;
      const { result, rerender } = renderHook(
        ({ v, feeds }) => useIncidents(v, { now, feeds }),
        { initialProps: { v: [], feeds: okFeeds() } },
      );
      for (let i = 1; i <= 3; i++) {
        act(() => { t = i * MIN; });
        rerender({ v: [], feeds: failFeeds() });
      }
      const inc = result.current.incidents.find((i) => i.subject.kind === 'operator');
      act(() => { result.current.selectIncident(inc.id); });

      expect(result.current.selectedIncident.projection).toBeNull();
    });
  });

  it('selecting an incident exposes a focus on its subject and involved vehicles', () => {
    let t = 0;
    const now = () => t;
    const { result, rerender } = renderHook(({ v }) => useIncidents(v, { now }), {
      initialProps: { v: stuck() },
    });
    act(() => { t = 6 * MIN; });
    rerender({ v: stuck() });

    expect(result.current.focus).toBeNull();

    const id = result.current.incidents[0].id;
    act(() => { result.current.selectIncident(id); });

    expect(result.current.focus).toEqual({
      center: [59.3293, 18.0686],
      vehicleIds: ['sl:bus-1'],
      isDataProblem: false,
    });
  });
});
