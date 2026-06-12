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
    });
  });
});
