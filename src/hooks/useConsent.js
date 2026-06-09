import { useCallback, useState } from 'react';

const STORAGE_KEY = 'rtt-privacy-notice-v1';

function readDismissed() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // private mode / quota — silently degrade; notice will reappear next load
  }
}

export function useConsent() {
  const [dismissed, setDismissed] = useState(readDismissed);

  const dismiss = useCallback(() => {
    writeDismissed();
    setDismissed(true);
  }, []);

  return { dismissed, dismiss };
}
