import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeadReckoning } from './useDeadReckoning';

const AC = [{ id: 'air:a', latitude: 59.33, longitude: 18.07, bearing: 0, speed: 600 }];

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('useDeadReckoning', () => {
  it('returns the truth immediately on a new fix', () => {
    const { result } = renderHook(() => useDeadReckoning(AC, 1000));
    expect(result.current).toEqual(AC);
  });

  it('projects positions forward on each tick (bearing 0 → moves north)', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1000); // = fetchedAt at mount
    const { result } = renderHook(() => useDeadReckoning(AC, 1000, { tickMs: 1000 }));
    const startLat = result.current[0].latitude;

    nowSpy.mockReturnValue(6000); // 5 s after the fix
    act(() => { vi.advanceTimersByTime(1000); }); // fire a tick → elapsed = 5 s
    expect(result.current[0].latitude).toBeGreaterThan(startLat);
    expect(result.current[0].id).toBe('air:a');
  });

  it('snaps back to truth when a new fix arrives', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1000);
    const { result, rerender } = renderHook(
      ({ ac, t }) => useDeadReckoning(ac, t, { tickMs: 1000 }),
      { initialProps: { ac: AC, t: 1000 } },
    );
    nowSpy.mockReturnValue(6000);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current[0].latitude).toBeGreaterThan(AC[0].latitude); // drifted

    const fresh = [{ ...AC[0], latitude: 60.0, longitude: 18.07 }];
    act(() => { rerender({ ac: fresh, t: 6000 }); });
    expect(result.current[0].latitude).toBe(60.0); // snapped to the new fix
  });

  it('does nothing without a fix or with no aircraft', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { result } = renderHook(() => useDeadReckoning([], null));
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current).toEqual([]);
  });
});
