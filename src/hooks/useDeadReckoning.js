import { useState, useEffect } from 'react';
import { predictAircraft } from '../services/aircraftPrediction';

/**
 * Animate aircraft between the slow real polls by dead-reckoning (idea #51).
 *
 * Given the last-good aircraft list and the timestamp of the fix that produced
 * it, this ticks every `tickMs` and projects each aircraft forward along its
 * track at its ground speed, so markers glide smoothly instead of jumping every
 * ~10 s (or flickering out on a throttled poll — the upstream hook keeps the
 * last-good list, so we keep extrapolating from the same fix).
 *
 * On each new fix the prediction snaps back to truth, then resumes projecting.
 *
 * @param {object[]} aircraft   last-good aircraft Vehicles (stable identity between fixes)
 * @param {number | null} fetchedAt  ms timestamp of the fix that produced them
 * @param {{ tickMs?: number }} [opts]
 * @returns {object[]} aircraft with predicted latitude/longitude
 */
export function useDeadReckoning(aircraft, fetchedAt, { tickMs = 1000 } = {}) {
  const [predicted, setPredicted] = useState(aircraft);

  useEffect(() => {
    setPredicted(aircraft); // snap to truth whenever a new fix arrives
    if (!fetchedAt || aircraft.length === 0) return undefined;

    const id = setInterval(() => {
      const elapsedSeconds = (Date.now() - fetchedAt) / 1000;
      setPredicted(predictAircraft(aircraft, elapsedSeconds));
    }, tickMs);
    return () => clearInterval(id);
  }, [aircraft, fetchedAt, tickMs]);

  return predicted;
}
