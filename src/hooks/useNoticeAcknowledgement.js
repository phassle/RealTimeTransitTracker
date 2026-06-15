import { useCallback, useState } from 'react';

// Bumped from v1 → v2 to re-disclose every returning user once after
// Trafikverket was added as a third-party webcam image source (ADR 0001).
// Bumped v2 → v3 when Windy and the curated webcam catalogue were added
// as webcam data sources — the notice must name every active source.
const STORAGE_KEY = 'rtt-privacy-notice-v3';

function readAcknowledged() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeAcknowledged() {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // private mode / quota — silently degrade; notice will reappear next load
  }
}

export function useNoticeAcknowledgement() {
  const [acknowledged, setAcknowledged] = useState(readAcknowledged);

  const acknowledge = useCallback(() => {
    writeAcknowledged();
    setAcknowledged(true);
  }, []);

  return { acknowledged, acknowledge };
}
