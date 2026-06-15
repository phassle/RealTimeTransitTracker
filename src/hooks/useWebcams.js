import { useEffect, useRef, useState } from 'react';
import { fetchCameras } from '../services/webcams';
import { useFetchState } from './useFetchState';

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
  const { data: cameras, error, loading, run } = useFetchState([]);
  const [errors, setErrors] = useState([]);
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

    run(
      async () => {
        const { cameras: cams, errors: errs } = await fetchCameras();
        if (aliveRef.current) setErrors(errs);
        // Total failure (no cameras, only errors) → surface a summary string;
        // partial/clean success → no summary so onSuccess caches the result.
        const errorMsg = cams.length === 0 && errs.length > 0
          ? errs.map(e => `${e.source}: ${e.message}`).join('; ')
          : null;
        return { data: cams, error: errorMsg };
      },
      // onSuccess fires only on clean success (errorMsg === null), so a total
      // failure leaves fetchedRef false and the next off→on toggle retries.
      () => { fetchedRef.current = true; },
    ).finally(() => {
      inFlightRef.current = false;
    });
  }, [enabled, run]);

  return { cameras: cameras ?? [], error, errors, loading };
}
