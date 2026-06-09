import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConsent } from './useConsent';

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

  it('returning visitor (previously dismissed) starts dismissed', () => {
    // Establish prior dismissal via the public interface only — never poke
    // the storage key directly. A separate hook instance is unmounted to
    // simulate the previous visit ending.
    const previous = renderHook(() => useConsent());
    act(() => {
      previous.result.current.dismiss();
    });
    previous.unmount();

    const { result } = renderHook(() => useConsent());
    expect(result.current.dismissed).toBe(true);
  });

  it('does not crash when storage read throws (private mode)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useConsent());
    expect(result.current.dismissed).toBe(false);
  });

  it('does not crash when storage write throws (private mode)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const { result } = renderHook(() => useConsent());
    expect(() =>
      act(() => {
        result.current.dismiss();
      })
    ).not.toThrow();
    // Local state still flips even though storage failed, so the user's
    // click is not ignored within the current session.
    expect(result.current.dismissed).toBe(true);
  });

  it('exposes exactly { dismissed, dismiss }', () => {
    const { result } = renderHook(() => useConsent());
    expect(Object.keys(result.current).sort()).toEqual(['dismiss', 'dismissed']);
    expect(typeof result.current.dismiss).toBe('function');
    expect(typeof result.current.dismissed).toBe('boolean');
  });
});
