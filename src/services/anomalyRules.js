// Anomaly rules — pure functions (history, now) → Anomaly[].
//
// An Anomaly is a single rule hit at a point in time carrying structured
// evidence (rule id, threshold, measured value, affected vehicle/line/operator,
// start time). No rule renders text — "Why flagged?" is built from evidence.
// See CONTEXT.md § Operational picture.
//
// MVP rule (Slice 1): stationary-on-active-trip. Thresholds are named constants
// to be calibrated against the live feed.

export const STATIONARY_DURATION_MS = 5 * 60 * 1000; // ~5 min stuck
export const DISPLACEMENT_THRESHOLD_M = 30;          // movement below this = "not progressing"

const EARTH_RADIUS_M = 6371000;

/** Great-circle distance between two lat/lng points, in metres. */
export function distanceMeters(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

function hasCoords(x) {
  return x && x.latitude != null && x.longitude != null;
}

function onActiveTrip(x) {
  return Boolean(x && x.tripId);
}

/**
 * Stationary-on-active-trip rule.
 *
 * For each vehicle present in the latest snapshot that is on an active trip,
 * walk backwards through history while the vehicle stayed within the
 * displacement threshold of its current position AND remained on an active
 * trip. If that contiguous stationary span has lasted at least the stationary
 * threshold, raise an Anomaly.
 *
 * Non-disruptions never flag: no active trip → skipped; still progressing →
 * an earlier observation exceeds the displacement threshold, cutting the span
 * short; stuck for less than the threshold → span too short.
 *
 * @param {{ time: number, vehicles: object[] }[]} snapshots chronological history
 * @param {number} now
 * @returns {object[]} anomalies
 */
export function detectStationaryAnomalies(snapshots, now) {
  if (!snapshots || snapshots.length === 0) return [];

  const latest = snapshots[snapshots.length - 1];
  const anomalies = [];

  for (const v of latest.vehicles) {
    if (!onActiveTrip(v) || !hasCoords(v)) continue;

    let startedAt = latest.time;
    for (let i = snapshots.length - 2; i >= 0; i--) {
      const prev = snapshots[i].vehicles.find((x) => x.id === v.id);
      if (!prev || !onActiveTrip(prev) || !hasCoords(prev)) break;
      if (distanceMeters(v.latitude, v.longitude, prev.latitude, prev.longitude) > DISPLACEMENT_THRESHOLD_M) {
        break;
      }
      startedAt = snapshots[i].time;
    }

    const measuredStationaryMs = now - startedAt;
    if (measuredStationaryMs >= STATIONARY_DURATION_MS) {
      anomalies.push({
        ruleId: 'stationary-on-active-trip',
        vehicleId: v.id,
        operator: v.operator ?? null,
        line: v.line ?? null,
        tripId: v.tripId,
        latitude: v.latitude,
        longitude: v.longitude,
        measuredStationaryMs,
        thresholdMs: STATIONARY_DURATION_MS,
        displacementThresholdM: DISPLACEMENT_THRESHOLD_M,
        startedAt,
        detectedAt: now,
      });
    }
  }

  return anomalies;
}
