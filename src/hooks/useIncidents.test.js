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
