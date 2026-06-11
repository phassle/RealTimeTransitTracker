import { useCallback, useState, useEffect } from 'react';

const STORAGE_KEY = 'rtt-theme-v1';

function readStoredTheme() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // private mode — degrade silently
  }
  return null;
}

function getOsTheme() {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function writeTheme(theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // private mode / quota — degrade silently; preference won't persist
  }
}

export function useTheme() {
  const [explicitTheme, setExplicitTheme] = useState(readStoredTheme);
  const [osTheme, setOsTheme] = useState(getOsTheme);

  const theme = explicitTheme ?? osTheme;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Subscribe to OS preference changes only while no explicit choice is stored.
  // When the user toggles, explicitTheme becomes non-null and this effect
  // cleans up the listener so OS changes are ignored from that point on.
  useEffect(() => {
    if (explicitTheme !== null) return;
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e) => setOsTheme(e.matches ? 'dark' : 'light');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } catch {
      // matchMedia unavailable — degrade silently
    }
  }, [explicitTheme]);

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    writeTheme(next);
    setExplicitTheme(next);
  }, [theme]);

  return { theme, toggleTheme };
}
