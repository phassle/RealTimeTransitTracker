import { useCallback, useState, useEffect } from 'react';

const STORAGE_KEY = 'rtt-theme-v1';

function readTheme() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // private mode — degrade silently
  }
  return 'light';
}

function writeTheme(theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // private mode / quota — degrade silently; preference won't persist
  }
}

export function useTheme() {
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      writeTheme(next);
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
