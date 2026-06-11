import { useEffect, useRef, useState } from 'react';
import { fetchCameras } from '../services/webcams';

/**
 * Fetch-on-first-enable hook for Sweden's open webcams.
 *
 * Mirrors the realtime-vehicles hook shape — { cameras, loading, error } —
 * but with a fundamentally different lifecycle: no polling, no impact on
 * the Trafiklab rate budget. The camera list is fetched the first time
 * `enabled` becomes true and reused for the rest of the session; toggling
 * off-then-on does NOT trigger a refetch.
 *
 * @param {boolean} enabled
 */
export function useWebcams(enabled) {
  const [cameras, setCameras] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);

    (async () => {
      try {
        const { cameras: cams, errors } = await fetchCameras();
        if (!aliveRef.current) return;
        setCameras(cams);
        if (cams.length === 0 && errors.length > 0) {
          const summary = errors.map(e => `${e.source}: ${e.message}`).join('; ');
          setError(summary);
        } else {
          setError(null);
        }
      } catch (e) {
        if (!aliveRef.current) return;
        setCameras([]);
        setError(e?.message || String(e));
      } finally {
        if (aliveRef.current) setLoading(false);
      }
    })();
  }, [enabled]);

  return { cameras, error, loading };
}
