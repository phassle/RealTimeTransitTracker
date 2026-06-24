import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAircraft } from './useAircraft';
import * as service from '../services/aircraft';

const SAMPLE = [
  { id: 'air:abc', mode: 'aircraft', line: 'SAS123', latitude: 59.3, longitude: 18.0 },
];

const CENTER = { lat: 59.33, lon: 18.07 };

describe('useAircraft', () => {
  beforeEach(() => {
    vi.spyOn(service, 'fetchAircraft').mockResolvedValue(SAMPLE);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('does not fetch while disabled', () => {
    renderHook(() => useAircraft(CENTER, false));
    expect(service.fetchAircraft).not.toHaveBeenCalled();
  });

  it('disabled hook exposes an empty aircraft list', () => {
    const { result } = renderHook(() => useAircraft(CENTER, false));
    expect(result.current.aircraft).toEqual([]);
  });

  it('fetches the viewport centre on enable and exposes the aircraft', async () => {
    const { result } = renderHook(() => useAircraft(CENTER, true));
    await waitFor(() => expect(result.current.aircraft).toEqual(SAMPLE));
    expect(service.fetchAircraft).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 59.33, lon: 18.07 }),
    );
  });

  it('polls on a fixed ~2s cadence', async () => {
    vi.useFakeTimers();
    renderHook(() => useAircraft(CENTER, true));
    // Initial immediate fetch.
    await vi.waitFor(() => expect(service.fetchAircraft).toHaveBeenCalledTimes(1));

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(service.fetchAircraft).toHaveBeenCalledTimes(2);

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(service.fetchAircraft).toHaveBeenCalledTimes(3);
  });

  it('pauses polling while the tab is hidden and resumes when visible', async () => {
    vi.useFakeTimers();
    renderHook(() => useAircraft(CENTER, true));
    await vi.waitFor(() => expect(service.fetchAircraft).toHaveBeenCalledTimes(1));

    // Hide the tab — polling stops.
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });

    const callsWhenHidden = service.fetchAircraft.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    expect(service.fetchAircraft).toHaveBeenCalledTimes(callsWhenHidden);

    // Show the tab — an immediate fetch resumes.
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(service.fetchAircraft.mock.calls.length).toBeGreaterThan(callsWhenHidden);
  });

  it('tolerates a rejected fetch silently — aircraft stay empty, no throw', async () => {
    service.fetchAircraft.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useAircraft(CENTER, true));
    // Give the rejected fetch a chance to settle.
    await new Promise(r => setTimeout(r, 10));
    expect(result.current.aircraft).toEqual([]);
  });

  it('does not throw when a fetch resolves after unmount', async () => {
    let resolvePending;
    service.fetchAircraft.mockImplementationOnce(
      () => new Promise(r => { resolvePending = r; }),
    );
    const { unmount } = renderHook(() => useAircraft(CENTER, true));
    unmount();
    resolvePending(SAMPLE);
    await new Promise(r => setTimeout(r, 10));
  });
});
