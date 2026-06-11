import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNoticeAcknowledgement } from './useNoticeAcknowledgement';

describe('useNoticeAcknowledgement', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fresh visitor: acknowledged is false', () => {
    const { result } = renderHook(() => useNoticeAcknowledgement());
    expect(result.current.acknowledged).toBe(false);
  });

  it('after acknowledge(): acknowledged becomes true', () => {
    const { result } = renderHook(() => useNoticeAcknowledgement());
    act(() => {
      result.current.acknowledge();
    });
    expect(result.current.acknowledged).toBe(true);
  });

  it('acknowledgement persists across re-mount', () => {
    const first = renderHook(() => useNoticeAcknowledgement());
    act(() => {
      first.result.current.acknowledge();
    });
    first.unmount();

    const second = renderHook(() => useNoticeAcknowledgement());
    expect(second.result.current.acknowledged).toBe(true);
  });

  it('returning visitor (previously acknowledged) starts acknowledged', () => {
    const previous = renderHook(() => useNoticeAcknowledgement());
    act(() => {
      previous.result.current.acknowledge();
    });
    previous.unmount();

    const { result } = renderHook(() => useNoticeAcknowledgement());
    expect(result.current.acknowledged).toBe(true);
  });

  it('does not crash when storage read throws (private mode)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useNoticeAcknowledgement());
    expect(result.current.acknowledged).toBe(false);
  });

  it('does not crash when storage write throws (private mode)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const { result } = renderHook(() => useNoticeAcknowledgement());
    expect(() =>
      act(() => {
        result.current.acknowledge();
      })
    ).not.toThrow();
    // Local state still flips even though storage failed, so the user's
    // click is not ignored within the current session.
    expect(result.current.acknowledged).toBe(true);
  });

  it('exposes exactly { acknowledged, acknowledge }', () => {
    const { result } = renderHook(() => useNoticeAcknowledgement());
    expect(Object.keys(result.current).sort()).toEqual(['acknowledge', 'acknowledged']);
    expect(typeof result.current.acknowledge).toBe('function');
    expect(typeof result.current.acknowledged).toBe('boolean');
  });
});
