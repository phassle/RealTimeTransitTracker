import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConsent } from './useConsent';

const KEY = 'rtt-privacy-notice-v1';

describe('useConsent', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fresh visitor: dismissed is false', () => {
    const { result } = renderHook(() => useConsent());
    expect(result.current.dismissed).toBe(false);
  });

  it('after dismiss(): dismissed becomes true', () => {
    const { result } = renderHook(() => useConsent());
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.dismissed).toBe(true);
  });

  it('dismissal persists across re-mount', () => {
    const first = renderHook(() => useConsent());
    act(() => {
      first.result.current.dismiss();
    });
    first.unmount();

    const second = renderHook(() => useConsent());
    expect(second.result.current.dismissed).toBe(true);
  });

  it('returning visitor with pre-existing dismissed flag starts dismissed', () => {
    window.localStorage.setItem(KEY, '1');
    const { result } = renderHook(() => useConsent());
    expect(result.current.dismissed).toBe(true);
  });

  it('does not crash when localStorage.getItem throws (private mode)', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useConsent());
    expect(result.current.dismissed).toBe(false);
    expect(spy).toHaveBeenCalled();
  });

  it('does not crash when localStorage.setItem throws (private mode)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const { result } = renderHook(() => useConsent());
    expect(() =>
      act(() => {
        result.current.dismiss();
      })
    ).not.toThrow();
    // local state still flips even though storage failed
    expect(result.current.dismissed).toBe(true);
  });

  it('exposes exactly { dismissed, dismiss }', () => {
    const { result } = renderHook(() => useConsent());
    expect(Object.keys(result.current).sort()).toEqual(['dismiss', 'dismissed']);
    expect(typeof result.current.dismiss).toBe('function');
    expect(typeof result.current.dismissed).toBe('boolean');
  });
});
