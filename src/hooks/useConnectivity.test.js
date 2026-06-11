import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConnectivity } from './useConnectivity';

describe('useConnectivity', () => {
  it('starts online when navigator.onLine is true', () => {
    const { result } = renderHook(() => useConnectivity());
    expect(result.current.isOnline).toBe(true);
  });

  it('goes offline on "offline" event', () => {
    const { result } = renderHook(() => useConnectivity());
    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(result.current.isOnline).toBe(false);
  });

  it('returns to online on "online" event', () => {
    const { result } = renderHook(() => useConnectivity());
    act(() => { window.dispatchEvent(new Event('offline')); });
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(result.current.isOnline).toBe(true);
  });

  it('does not update state after unmount', () => {
    const { result, unmount } = renderHook(() => useConnectivity());
    unmount();
    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(result.current.isOnline).toBe(true);
  });

  it('exposes exactly { isOnline }', () => {
    const { result } = renderHook(() => useConnectivity());
    expect(Object.keys(result.current)).toEqual(['isOnline']);
    expect(typeof result.current.isOnline).toBe('boolean');
  });
});
