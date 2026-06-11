import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWebcams } from './useWebcams';
import * as service from '../services/webcams';

const SAMPLE = [
  { id: 'trafikverket:1', name: 'A', type: 'traffic', media: 'image',
    lat: 59.3, lon: 18.0, imageUrl: 'x', pageUrl: 'x',
    source: 'trafikverket', attribution: 'Trafikverket', lastUpdated: null },
];

describe('useWebcams', () => {
  beforeEach(() => {
    vi.spyOn(service, 'fetchCameras').mockResolvedValue({
      cameras: SAMPLE,
      errors: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not fetch while disabled', () => {
    renderHook(() => useWebcams(false));
    expect(service.fetchCameras).not.toHaveBeenCalled();
  });

  it('disabled hook exposes empty cameras, no error, not loading', () => {
    const { result } = renderHook(() => useWebcams(false));
    expect(result.current.cameras).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('fetches once on first enable and exposes the cameras', async () => {
    const { result } = renderHook(({ enabled }) => useWebcams(enabled), {
      initialProps: { enabled: true },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(service.fetchCameras).toHaveBeenCalledTimes(1);
    expect(result.current.cameras).toEqual(SAMPLE);
    expect(result.current.error).toBeNull();
  });

  it('does not refetch when toggled off and on within a session', async () => {
    const { result, rerender } = renderHook(({ enabled }) => useWebcams(enabled), {
      initialProps: { enabled: false },
    });
    expect(service.fetchCameras).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(service.fetchCameras).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });
    rerender({ enabled: true });
    rerender({ enabled: false });
    rerender({ enabled: true });

    // Give any stray async work a chance to fire.
    await new Promise(r => setTimeout(r, 10));
    expect(service.fetchCameras).toHaveBeenCalledTimes(1);
    expect(result.current.cameras).toEqual(SAMPLE);
  });

  it('cameras remain available after toggling off (cached for the session)', async () => {
    const { result, rerender } = renderHook(({ enabled }) => useWebcams(enabled), {
      initialProps: { enabled: true },
    });
    await waitFor(() => expect(result.current.cameras).toHaveLength(1));

    rerender({ enabled: false });
    rerender({ enabled: true });

    expect(result.current.cameras).toEqual(SAMPLE);
  });

  it('surfaces error state when the service reports errors and no cameras', async () => {
    service.fetchCameras.mockResolvedValueOnce({
      cameras: [],
      errors: [{ source: 'trafikverket', message: 'HTTP 503' }],
    });
    const { result } = renderHook(() => useWebcams(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cameras).toEqual([]);
    expect(result.current.error).toMatch(/trafikverket|503/i);
  });

  it('does not throw when the service throws — keeps cameras empty and surfaces an error', async () => {
    service.fetchCameras.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useWebcams(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cameras).toEqual([]);
    expect(result.current.error).toMatch(/boom/i);
  });
});
