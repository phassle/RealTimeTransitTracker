import { useState, useRef, useEffect, useCallback } from 'react';

// All navigator.geolocation interaction lives behind this hook (the project's
// "I/O behind a hook" rule). The position is ephemeral and client-only
// (ADR 0005): held in React state only, never persisted, never sent anywhere.
//
// status is a discriminated enum: idle | locating | success | denied | unavailable.
// This slice (issue #112) establishes idle → locating → success; denied/unavailable
// are produced by the error path but their button UI lands in a later slice.

// Standard accuracy (not GPS-grade) for a fast city-level fix; ~10s timeout;
// a modest cache so a recent fix can return immediately.
const GEO_OPTIONS = { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 };

export function useGeolocation() {
  const [status, setStatus] = useState('idle');
  const [position, setPosition] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('unavailable');
      return;
    }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!mountedRef.current) return;
        setPosition({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setStatus('success');
      },
      (err) => {
        if (!mountedRef.current) return;
        setStatus(err && err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      GEO_OPTIONS,
    );
  }, []);

  return { locate, position, status };
}
