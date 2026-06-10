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

  describe('OS preference', () => {
    function mockMatchMedia(prefersDark) {
      let currentMatches = prefersDark;
      const listeners = [];
      const mq = {
        get matches() { return currentMatches; },
        addEventListener: (_, fn) => listeners.push(fn),
        removeEventListener: (_, fn) => {
          const i = listeners.indexOf(fn);
          if (i >= 0) listeners.splice(i, 1);
        },
      };
      vi.stubGlobal('matchMedia', () => mq);
      return {
        triggerChange(matches) {
          currentMatches = matches;
          listeners.forEach(fn => fn({ matches }));
        },
      };
    }

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('first visit: OS dark → dark theme', () => {
      mockMatchMedia(true);
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('dark');
    });

    it('first visit: OS light → light theme', () => {
      mockMatchMedia(false);
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('light');
    });

    it('first visit: matchMedia unavailable → light theme', () => {
      vi.stubGlobal('matchMedia', () => { throw new Error('not supported'); });
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('light');
    });

    it('explicit stored choice overrides OS preference', () => {
      // establish dark OS, toggle to light explicitly
      mockMatchMedia(true);
      const setup = renderHook(() => useTheme());
      expect(setup.result.current.theme).toBe('dark');
      act(() => { setup.result.current.toggleTheme(); }); // dark → light (stored)
      setup.unmount();

      // new session: OS still dark, but stored explicit choice is light
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('light');
    });

    it('follows live OS change when no explicit choice', () => {
      const { triggerChange } = mockMatchMedia(false);
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('light');

      act(() => triggerChange(true));
      expect(result.current.theme).toBe('dark');
    });

    it('ignores live OS change once explicit choice exists', () => {
      const { triggerChange } = mockMatchMedia(true); // OS dark
      const { result } = renderHook(() => useTheme());
      act(() => { result.current.toggleTheme(); }); // dark → light (explicit)
      expect(result.current.theme).toBe('light');

      act(() => triggerChange(false)); // OS changes to light
      expect(result.current.theme).toBe('light'); // stays light (explicit wins)
      act(() => triggerChange(true));  // OS changes back to dark
      expect(result.current.theme).toBe('light'); // still explicit light
    });
  });
});
