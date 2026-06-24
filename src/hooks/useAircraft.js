import { useState, useEffect, useRef } from 'react';
import { fetchAircraft } from '../services/aircraft';

/**
 * Poll live aircraft around a viewport point and expose them as Vehicles.
 *
 * Separate from the transit polling hook because the transit poll interval
 * scales with the number of watched operators (and would leave aircraft stale)
 * and because an airplanes.live failure must never enter the transit
 * feedOutcomes. The hook polls on the caller's cadence, pauses on tab-hidden
 * (same discipline as the transit hook), and tolerates fetch/parse failure
 * silently — a failed poll resolves to `null` and is **ignored** (the last-good
 * list is kept, so aircraft don't flicker out on a transient throttle), and no
 * error is surfaced (PRD #165; keep-last-good for idea #51).
 *
 * Returns the last-good aircraft list plus `fetchedAt` — the timestamp of the
 * fix that produced it — so a caller can dead-reckon positions forward between
 * the (deliberately slow) real polls (idea #51).
 *
 * @param {{ lat: number, lon: number, radius: number } | null} query
 * @param {{ enabled?: boolean, intervalMs?: number }} [opts]
 * @returns {{ aircraft: object[], fetchedAt: number | null }}
 */
export function useAircraft(query, { enabled = true, intervalMs = 2000 } = {}) {
  const [aircraft, setAircraft] = useState([]);
  const [fetchedAt, setFetchedAt] = useState(null);
  const intervalRef = useRef(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  // Serialise the query so the polling effect only re-subscribes when the
  // viewport actually moves, not on every render.
  const queryKey = query ? `${query.lat},${query.lon},${query.radius}` : null;

  useEffect(() => {
    if (!enabled || !query) {
      setAircraft([]);
      setFetchedAt(null);
      return;
    }

    // Per-effect guard: a fetch in flight when the query changes (pan/zoom) or
    // the hook unmounts must not apply its now-stale result over the fresh
    // viewport's aircraft. Set in this effect's cleanup, so each query owns its
    // own flag (aliveRef alone only covers unmount, not query changes).
    let cancelled = false;

    const fetchData = async () => {
      try {
        const next = await fetchAircraft(query); // null on failure, [] / [...] on success
        if (cancelled || !aliveRef.current) return;
        // null = transient failure: keep the last-good list AND its fetchedAt, so
        // dead-reckoning keeps extrapolating instead of the planes blanking out.
        if (next != null) {
          setAircraft(next);
          setFetchedAt(Date.now());
        }
      } catch {
        // Defensive: fetchAircraft is total (returns null on failure), but a poll
        // must never throw — keep the last-good list on any unexpected error.
      }
    };

    const startPolling = () => {
      if (!intervalRef.current) {
        intervalRef.current = setInterval(fetchData, intervalMs);
      }
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchData();
        startPolling();
      }
    };

    fetchData();
    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, queryKey, intervalMs]);

  return { aircraft, fetchedAt };
}
