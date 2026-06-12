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
 * Exception: a fetch that yields zero cameras (every source failed or threw)
 * is not cached — the next off→on toggle retries, so a transient outage
 * doesn't lock the layer empty for the whole session.
 *
 * `errors` carries per-source failures ({ source, message }) even when other
 * sources delivered cameras, so partial outages are visible. `error` stays a
 * summary string for the all-sources-failed case only.
 *
 * @param {boolean} enabled
 */
export function useWebcams(enabled) {
  const [cameras, setCameras] = useState([]);
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);
  const inFlightRef = useRef(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || fetchedRef.current || inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);

    (async () => {
      try {
        const { cameras: cams, errors: errs } = await fetchCameras();
        if (!aliveRef.current) return;
        setCameras(cams);
        setErrors(errs);
        if (cams.length === 0 && errs.length > 0) {
          const summary = errs.map(e => `${e.source}: ${e.message}`).join('; ');
          setError(summary);
          // Total failure — leave fetchedRef false so the next enable retries.
        } else {
          setError(null);
          fetchedRef.current = true;
        }
      } catch (e) {
        if (!aliveRef.current) return;
        setCameras([]);
        setErrors([]);
        setError(e?.message || String(e));
      } finally {
        inFlightRef.current = false;
        if (aliveRef.current) setLoading(false);
      }
    })();
  }, [enabled]);

  return { cameras, error, errors, loading };
}
