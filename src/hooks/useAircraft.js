import { useEffect, useRef, useState } from 'react';
import { fetchAircraft } from '../services/aircraft';

// Aircraft are non-essential overlay data fetched on a fixed ~2 s cadence,
// separate from the transit poll: the transit interval scales with the number
// of watched operators (up to ~30 s) and would leave aircraft stale, and an
// airplanes.live failure must never enter the transit feedOutcomes.
const AIRCRAFT_POLL_INTERVAL = 2000;

// This slice fetches the viewport centre with a fixed default radius; the zoom
// gate and viewport-derived radius are deferred to the follow-up slice.
const DEFAULT_RADIUS_NM = 100;

/**
 * Poll airplanes.live for aircraft around a centre point.
 *
 * @param {{ lat: number, lon: number } | null} center
 * @param {boolean} enabled
 * @returns {{ aircraft: object[] }}
 */
export function useAircraft(center, enabled = true) {
  const [aircraft, setAircraft] = useState([]);
  const aliveRef = useRef(true);
  const intervalRef = useRef(null);
  // Hold the latest centre in a ref so a centre change does not restart the
  // poll loop; each tick reads the current value.
  const centerRef = useRef(center);
  centerRef.current = center;

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setAircraft([]);
      return undefined;
    }

    const poll = async () => {
      const c = centerRef.current;
      if (!c) return;
      try {
        const next = await fetchAircraft({ lat: c.lat, lon: c.lon, radius: DEFAULT_RADIUS_NM });
        if (aliveRef.current) setAircraft(next);
      } catch {
        // Silent: aircraft are non-essential overlay data. They simply don't
        // show; transit Vehicles are unaffected and no error is surfaced.
      }
    };

    const startPolling = () => {
      if (!intervalRef.current) {
        intervalRef.current = setInterval(poll, AIRCRAFT_POLL_INTERVAL);
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
        poll();
        startPolling();
      }
    };

    poll();
    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled]);

  return { aircraft };
}
