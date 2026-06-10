import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from './useTheme';

describe('useTheme', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fresh visitor: theme is light', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('after toggleTheme(): theme flips to dark', () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('dark');
  });

  it('after toggleTheme() twice: theme is back to light', () => {
    const { result } = renderHook(() => useTheme());
    act(() => { result.current.toggleTheme(); });
    act(() => { result.current.toggleTheme(); });
    expect(result.current.theme).toBe('light');
  });

  it('chosen dark theme persists across re-mount', () => {
    const first = renderHook(() => useTheme());
    act(() => { first.result.current.toggleTheme(); });
    first.unmount();

    const second = renderHook(() => useTheme());
    expect(second.result.current.theme).toBe('dark');
  });

  it('returning visitor with dark preference starts dark', () => {
    const prev = renderHook(() => useTheme());
    act(() => { prev.result.current.toggleTheme(); });
    prev.unmount();

    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
  });

  it('sets data-theme attribute on documentElement to reflect theme', () => {
    const { result } = renderHook(() => useTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    act(() => { result.current.toggleTheme(); });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('does not crash when storage read throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('does not crash when storage write throws; session toggle still works', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const { result } = renderHook(() => useTheme());
    expect(() =>
      act(() => { result.current.toggleTheme(); })
    ).not.toThrow();
    expect(result.current.theme).toBe('dark');
  });

  it('preference is not remembered when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const first = renderHook(() => useTheme());
    act(() => { first.result.current.toggleTheme(); });
    first.unmount();

    vi.restoreAllMocks();
    const second = renderHook(() => useTheme());
    expect(second.result.current.theme).toBe('light');
  });

  it('exposes exactly { theme, toggleTheme }', () => {
    const { result } = renderHook(() => useTheme());
    expect(Object.keys(result.current).sort()).toEqual(['theme', 'toggleTheme']);
    expect(typeof result.current.theme).toBe('string');
    expect(typeof result.current.toggleTheme).toBe('function');
  });
});
