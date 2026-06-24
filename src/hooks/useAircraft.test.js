import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAircraft } from './useAircraft';
import * as service from '../services/aircraft';
import { deriveAircraftQuery, AIRCRAFT_MIN_ZOOM } from '../services/aircraft';

const SAMPLE = [
  { id: 'air:abc', line: 'SAS123', mode: 'aircraft', latitude: 59.3, longitude: 18.0 },
];
const QUERY = { lat: 59.3, lon: 18.0, radius: 100 };

describe('useAircraft', () => {
  beforeEach(() => {
    vi.spyOn(service, 'fetchAircraft').mockResolvedValue(SAMPLE);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('fetches on mount and exposes the mapped aircraft', async () => {
    const { result } = renderHook(() => useAircraft(QUERY, { enabled: true }));
    await waitFor(() => expect(result.current.aircraft).toEqual(SAMPLE));
    expect(service.fetchAircraft).toHaveBeenCalled();
    expect(service.fetchAircraft.mock.calls[0][0]).toEqual(QUERY);
  });

  it('does not fetch when disabled', () => {
    renderHook(() => useAircraft(QUERY, { enabled: false }));
    expect(service.fetchAircraft).not.toHaveBeenCalled();
  });

  it('does not fetch when there is no query', () => {
    renderHook(() => useAircraft(null, { enabled: true }));
    expect(service.fetchAircraft).not.toHaveBeenCalled();
  });

  it('polls on the configured cadence', async () => {
    vi.useFakeTimers();
    renderHook(() => useAircraft(QUERY, { enabled: true, intervalMs: 2000 }));
    await vi.waitFor(() => expect(service.fetchAircraft).toHaveBeenCalledTimes(1));

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(service.fetchAircraft).toHaveBeenCalledTimes(2);

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(service.fetchAircraft).toHaveBeenCalledTimes(3);
  });

  it('tolerates a rejected fetch silently — aircraft stays empty, no throw', async () => {
    service.fetchAircraft.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useAircraft(QUERY, { enabled: true }));
    await new Promise(r => setTimeout(r, 10));
    expect(result.current.aircraft).toEqual([]);
  });

  it('does not throw when a poll resolves after unmount', async () => {
    let resolvePending;
    service.fetchAircraft.mockImplementationOnce(
      () => new Promise(r => { resolvePending = r; }),
    );
    const { unmount } = renderHook(() => useAircraft(QUERY, { enabled: true }));
    unmount();
    resolvePending(SAMPLE);
    await new Promise(r => setTimeout(r, 10));
  });

  it('ignores a fetch that resolves after the query changed (no stale viewport aircraft)', async () => {
    const FRESH = [{ id: 'air:fresh', mode: 'aircraft', latitude: 2, longitude: 2 }];
    const STALE = [{ id: 'air:stale', mode: 'aircraft', latitude: 1, longitude: 1 }];
    let resolveStale;
    // Query A's fetch hangs; once the query changes, B resolves FRESH.
    service.fetchAircraft.mockImplementationOnce(
      () => new Promise(r => { resolveStale = r; }),
    );
    service.fetchAircraft.mockResolvedValue(FRESH);

    const { result, rerender } = renderHook(
      ({ q }) => useAircraft(q, { enabled: true }),
      { initialProps: { q: { lat: 1, lon: 1, radius: 10 } } },
    );
    rerender({ q: { lat: 2, lon: 2, radius: 10 } }); // supersedes query A
    await waitFor(() => expect(result.current.aircraft).toEqual(FRESH));

    // Query A's late result must not clobber the current viewport's aircraft.
    await act(async () => { resolveStale(STALE); });
    await new Promise(r => setTimeout(r, 10));
    expect(result.current.aircraft).toEqual(FRESH);
  });
});

// Zoom gate + viewport-radius derivation (PRD #165, Slice 2). These drive the
// hook through the same deriveAircraftQuery seam App uses, asserting the gate at
// the hook boundary: no fetch below the threshold, a viewport-derived
// centre/radius at/above it, with the radius clamped to 250 nm.
describe('useAircraft — zoom-gated viewport fetching', () => {
  const STHLM_BOUNDS = { south: 59.2, west: 17.8, north: 59.45, east: 18.3 };
  const WIDE_BOUNDS = { south: 40, west: 0, north: 70, east: 30 };

  beforeEach(() => {
    vi.spyOn(service, 'fetchAircraft').mockResolvedValue(SAMPLE);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('does not fetch below the zoom threshold', () => {
    const query = deriveAircraftQuery(STHLM_BOUNDS, AIRCRAFT_MIN_ZOOM - 1);
    renderHook(() => useAircraft(query, { enabled: true }));
    expect(service.fetchAircraft).not.toHaveBeenCalled();
  });

  it('fetches a viewport-derived centre/radius at the zoom threshold', async () => {
    const query = deriveAircraftQuery(STHLM_BOUNDS, AIRCRAFT_MIN_ZOOM);
    renderHook(() => useAircraft(query, { enabled: true }));
    await waitFor(() => expect(service.fetchAircraft).toHaveBeenCalled());
    const arg = service.fetchAircraft.mock.calls[0][0];
    expect(arg.lat).toBeCloseTo((59.2 + 59.45) / 2, 5);
    expect(arg.lon).toBeCloseTo((17.8 + 18.3) / 2, 5);
    expect(arg.radius).toBeGreaterThan(0);
    expect(arg.radius).toBeLessThan(250);
  });

  it('clamps the requested radius to 250 nm for a wide viewport', async () => {
    const query = deriveAircraftQuery(WIDE_BOUNDS, AIRCRAFT_MIN_ZOOM);
    renderHook(() => useAircraft(query, { enabled: true }));
    await waitFor(() => expect(service.fetchAircraft).toHaveBeenCalled());
    expect(service.fetchAircraft.mock.calls[0][0].radius).toBe(250);
  });
});
