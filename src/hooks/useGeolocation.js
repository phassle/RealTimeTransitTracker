import { useState, useRef, useEffect, useCallback } from 'react';

// All navigator.geolocation interaction lives behind this hook (the project's
// "I/O behind a hook" rule). The position is ephemeral and client-only
// (ADR 0006): held in React state only, never persisted, never sent anywhere.
//
// status is a discriminated enum: idle | locating | success | denied | unavailable.
// Capability is evaluated up front (issue #113): if navigator.geolocation is
// missing/blocked (insecure origin, no API support) the hook starts in
// unavailable so the button is disabled before any tap. denied is the distinct
// terminal state for a refused permission — refusal and absent capability are
// never conflated (cf. the source-absence-vs-failure discipline).

// Geolocation capability — absent API or insecure origin means the feature can
// never produce a fix, distinct from a fix that was refused.
function geolocationAvailable() {
  return typeof navigator !== 'undefined' && !!navigator.geolocation;
}

// Standard accuracy (not GPS-grade) for a fast city-level fix; ~10s timeout;
// a modest cache so a recent fix can return immediately.
const GEO_OPTIONS = { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 };

export function useGeolocation() {
  const [status, setStatus] = useState(() => (geolocationAvailable() ? 'idle' : 'unavailable'));
  const [position, setPosition] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const locate = useCallback(() => {
    if (!geolocationAvailable()) {
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
