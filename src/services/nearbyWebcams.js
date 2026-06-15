// Nearby webcams — pure function (incident subject, webcams) → ranked nearby list.
//
// Lists the Webcams nearest an Incident's subject for visual Verification
// (PRD #84 stories 19–20). Distance-bounded so a camera too far to show the
// situation is never offered; traffic cameras rank first (they look at the
// road), then nearer-before-farther. Operator-subject Incidents (Feed outage)
// carry no ground geometry, so they get no webcams. Reuses the existing Webcam
// domain (Camera type, media capability) — this module only ranks; rendering
// reuses the webcam popup conventions (ADR 0004).

import { distanceMeters } from './anomalyRules';

// Distance bound, in metres, for "near the subject". A calibration constant
// (exploratory à la explore-routes, not a unit-tested value); kept generous so
// a city Incident still surfaces a few cameras given Sweden's sparse coverage.
export const WEBCAM_DISTANCE_BOUND_M = 30000;

function rankOfType(type) {
  return type === 'traffic' ? 0 : 1;
}

/**
 * @param {{ kind: string, latitude?: number, longitude?: number }|null} subject
 * @param {Array<{ lat: number, lon: number, type: string }>} cameras
 * @param {{ bound?: number }} [options]
 * @returns {Array<object>} cameras within the bound, each with `distanceM`,
 *   ordered traffic-first then by ascending distance.
 */
export function nearbyWebcams(subject, cameras, { bound = WEBCAM_DISTANCE_BOUND_M } = {}) {
  if (!subject || subject.kind !== 'geographic') return [];

  const within = [];
  for (const cam of cameras ?? []) {
    if (cam == null || cam.lat == null || cam.lon == null) continue;
    const distanceM = distanceMeters(subject.latitude, subject.longitude, cam.lat, cam.lon);
    if (distanceM <= bound) within.push({ ...cam, distanceM });
  }

  within.sort((a, b) => {
    const byType = rankOfType(a.type) - rankOfType(b.type);
    return byType !== 0 ? byType : a.distanceM - b.distanceM;
  });

  return within;
}
