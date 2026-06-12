import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useRealtimeVehicles } from './useRealtimeVehicles';
import * as service from '../services/trafiklab';

const SAMPLE = [
  { id: 'sl:bus-1', operator: 'sl', line: '1', mode: 'bus', latitude: 59.3, longitude: 18.0 },
];
const SAMPLE_OUTCOMES = [{ operator: 'sl', ok: true, vehicleCount: 1, dataTimestamp: 1000 }];
const feedResult = () => ({ vehicles: SAMPLE, outcomes: SAMPLE_OUTCOMES });

describe('useRealtimeVehicles', () => {
  beforeEach(() => {
    vi.spyOn(service, 'fetchOperatorFeeds').mockResolvedValue(feedResult());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Poll and manual refresh share one fetch path', () => {
    it('loading starts true; transitions to false after first poll resolves', async () => {
      const { result } = renderHook(() => useRealtimeVehicles(['sl'], 5000, true));
      expect(result.current.loading).toBe(true);
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.vehicles).toEqual(SAMPLE);
      expect(result.current.error).toBeNull();
    });

    it('refresh: loading → true → false with same data/error outcome as poll', async () => {
      const { result } = renderHook(() => useRealtimeVehicles(['sl'], 5000, true));
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => { result.current.refresh(); });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.vehicles).toEqual(SAMPLE);
      expect(result.current.error).toBeNull();
    });

    it('poll error: sets error and clears loading', async () => {
      service.fetchOperatorFeeds.mockRejectedValueOnce(new Error('feed down'));
      const { result } = renderHook(() => useRealtimeVehicles(['sl'], 5000, true));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.error).toBe('feed down');
      expect(result.current.vehicles).toEqual([]);
    });

    it('refresh error: sets error and clears loading — same outcome as poll error', async () => {
      const { result } = renderHook(() => useRealtimeVehicles(['sl'], 5000, true));
      await waitFor(() => expect(result.current.loading).toBe(false));

      service.fetchOperatorFeeds.mockRejectedValueOnce(new Error('refresh boom'));
      act(() => { result.current.refresh(); });
      await waitFor(() => expect(result.current.error).toBe('refresh boom'));
      expect(result.current.loading).toBe(false);
    });

    it('refresh calls the same service as the poll loop', async () => {
      const { result } = renderHook(() => useRealtimeVehicles(['sl'], 5000, true));
      await waitFor(() => expect(result.current.loading).toBe(false));
      const before = service.fetchOperatorFeeds.mock.calls.length;

      await act(async () => { await result.current.refresh(); });
      expect(service.fetchOperatorFeeds.mock.calls.length).toBe(before + 1);
    });
  });

  describe('Refresh resolving after unmount updates nothing', () => {
    it('does not throw when a pending refresh resolves after unmount', async () => {
      const { result, unmount } = renderHook(() =>
        useRealtimeVehicles(['sl'], 5000, true),
      );
      await waitFor(() => expect(result.current.loading).toBe(false));

      let resolvePending;
      service.fetchOperatorFeeds.mockImplementationOnce(
        () => new Promise(r => { resolvePending = r; }),
      );

      act(() => { result.current.refresh(); });
      unmount();

      resolvePending(SAMPLE);
      await new Promise(r => setTimeout(r, 10));
    });

    it('does not throw when the initial poll resolves after unmount', async () => {
      let resolvePending;
      service.fetchOperatorFeeds.mockImplementationOnce(
        () => new Promise(r => { resolvePending = r; }),
      );

      const { unmount } = renderHook(() => useRealtimeVehicles(['sl'], 5000, true));
      unmount();

      resolvePending(SAMPLE);
      await new Promise(r => setTimeout(r, 10));
    });
  });
});
