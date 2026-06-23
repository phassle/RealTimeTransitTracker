import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeolocation } from './useGeolocation';

// Capture the success/error callbacks getCurrentPosition is invoked with so
// tests can drive the async resolution deterministically (cf. useConnectivity).
function installGeolocation() {
  const calls = [];
  const getCurrentPosition = vi.fn((onSuccess, onError, options) => {
    calls.push({ onSuccess, onError, options });
  });
  navigator.geolocation = { getCurrentPosition };
  return { calls, getCurrentPosition };
}

const malmoFix = {
  coords: { latitude: 55.6050, longitude: 13.0038 },
};

describe('useGeolocation', () => {
  let original;

  beforeEach(() => {
    original = navigator.geolocation;
  });

  afterEach(() => {
    navigator.geolocation = original;
    vi.restoreAllMocks();
  });

  it('starts idle with no position', () => {
    installGeolocation();
    const { result } = renderHook(() => useGeolocation());
    expect(result.current.status).toBe('idle');
    expect(result.current.position).toBeNull();
  });

  it('reports locating while a fix is pending', () => {
    installGeolocation();
    const { result } = renderHook(() => useGeolocation());
    act(() => { result.current.locate(); });
    expect(result.current.status).toBe('locating');
    expect(result.current.position).toBeNull();
  });

  it('yields success and the position when a fix arrives', () => {
    const { calls } = installGeolocation();
    const { result } = renderHook(() => useGeolocation());
    act(() => { result.current.locate(); });
    act(() => { calls[0].onSuccess(malmoFix); });
    expect(result.current.status).toBe('success');
    expect(result.current.position).toEqual({ latitude: 55.6050, longitude: 13.0038 });
  });

  it('does not update state after unmount', () => {
    const { calls } = installGeolocation();
    const { result, unmount } = renderHook(() => useGeolocation());
    act(() => { result.current.locate(); });
    unmount();
    act(() => { calls[0].onSuccess(malmoFix); });
    expect(result.current.status).toBe('locating');
    expect(result.current.position).toBeNull();
  });

  it('requests a standard-accuracy fix with a ~10s timeout', () => {
    const { calls } = installGeolocation();
    const { result } = renderHook(() => useGeolocation());
    act(() => { result.current.locate(); });
    expect(calls[0].options).toMatchObject({ enableHighAccuracy: false, timeout: 10000 });
    expect(calls[0].options.maximumAge).toBeGreaterThan(0);
  });

  it('evaluates capability on mount: a missing geolocation API yields unavailable', () => {
    navigator.geolocation = undefined;
    const { result } = renderHook(() => useGeolocation());
    expect(result.current.status).toBe('unavailable');
  });

  it('resolves to denied when the user rejects the permission', () => {
    const { calls } = installGeolocation();
    const { result } = renderHook(() => useGeolocation());
    act(() => { result.current.locate(); });
    act(() => { calls[0].onError({ code: 1, PERMISSION_DENIED: 1 }); });
    expect(result.current.status).toBe('denied');
  });

  it('resolves to unavailable when the position is otherwise unobtainable', () => {
    const { calls } = installGeolocation();
    const { result } = renderHook(() => useGeolocation());
    act(() => { result.current.locate(); });
    act(() => { calls[0].onError({ code: 2, PERMISSION_DENIED: 1 }); });
    expect(result.current.status).toBe('unavailable');
  });

  it('exposes exactly { locate, position, status }', () => {
    installGeolocation();
    const { result } = renderHook(() => useGeolocation());
    expect(Object.keys(result.current).sort()).toEqual(['locate', 'position', 'status']);
    expect(typeof result.current.locate).toBe('function');
  });
});
