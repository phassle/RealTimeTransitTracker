import { useEffect, useRef } from 'react';

/**
 * Follow-a-vehicle logic, the test seam for the Followed-vehicle feature
 * (PRD #165, slice #167). Given the live Vehicle list, the selected id and the
 * follow flag, it:
 *   - resolves the followed Vehicle's current position (so App can panTo it on
 *     every update, at the user's current zoom — see Map's pan glue);
 *   - emits a one-shot exit signal (`onExit`) when the followed id is no longer
 *     in the feed, so follow ends silently (selection cleared, no error).
 *
 * Pure of any Leaflet/DOM concern: it only reads the list and reports. Follow is
 * session-only (no persistence) and orthogonal to the command-center highlight.
 *
 * @param {{ vehicles?: Array, selectedVehicleId?: string|null, followMode?: boolean, onExit?: () => void }} params
 * @returns {{ followedPosition: [number, number] | null }}
 */
export function useFollowVehicle({ vehicles = [], selectedVehicleId = null, followMode = false, onExit } = {}) {
  const following = followMode && selectedVehicleId != null;
  const followed = following
    ? vehicles.find((v) => v.id === selectedVehicleId) ?? null
    : null;

  const followedPosition =
    followed && followed.latitude != null && followed.longitude != null
      ? [followed.latitude, followed.longitude]
      : null;

  // Fire the exit signal exactly once on the transition from present to absent,
  // never on the initial render and never again while the id stays gone.
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const wasPresentRef = useRef(false);

  useEffect(() => {
    if (!following) {
      wasPresentRef.current = false;
      return;
    }
    const present = vehicles.some((v) => v.id === selectedVehicleId);
    if (!present && wasPresentRef.current) {
      onExitRef.current?.();
    }
    wasPresentRef.current = present;
  }, [following, vehicles, selectedVehicleId]);

  return { followedPosition };
}
