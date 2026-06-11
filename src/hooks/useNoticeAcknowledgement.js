import { useCallback, useState } from 'react';

const STORAGE_KEY = 'rtt-privacy-notice-v1';

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
