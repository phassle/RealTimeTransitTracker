import { useEffect, useRef } from 'react';
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
 * @param {boolean} enabled
 */
export function useWebcams(enabled) {
  const { data: cameras, error, loading, run } = useFetchState([]);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!enabled || fetchedRef.current) return;
    fetchedRef.current = true;

    run(async () => {
      const { cameras: cams, errors } = await fetchCameras();
      const errorMsg = cams.length === 0 && errors.length > 0
        ? errors.map(e => `${e.source}: ${e.message}`).join('; ')
        : null;
      return { data: cams, error: errorMsg };
    });
  }, [enabled, run]);

  return { cameras: cameras ?? [], error, loading };
}
