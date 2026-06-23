// Expected impact Projection — pure forward-looking derivation for a geographic
// Incident. A Projection is NOT an Anomaly: it forecasts who is *about to* be
// affected by a known disruption, it produces no Anomaly, never touches the
// Anomaly→Incident clustering seam, and is recomputed transiently per poll for
// the selected Incident only (see ADR 0005, CONTEXT.md § Projection).
//
// The Downstream vehicles are the others in the latest snapshot that share the
// stalled vehicle's `(operator, line, direction)` triple AND lie genuinely
// *behind* the disruption. With no GTFS static stops / route polyline available,
// "behind" is a coarse geometric heuristic (CONTEXT.md § Downstream vehicles,
// ADR 0005): a candidate is downstream only when the vector (candidate − stalled)
// points against the stalled vehicle's bearing (it has not yet reached the stall
// point) and it sits within MAX_DOWNSTREAM_DISTANCE_M.
//
// Slice 3 adds a coarse delay magnitude: first-order the measured stall duration
// (from the stationary Anomaly's evidence), refined by the growth in a
// time-headway proxy between the nearest Downstream vehicle and the stall across
// the buffer window, surfaced only as a low-precision bucket (coarseDelayLabel).
//
// Slice 4 adds a confidence score (0–1) per affected (line, direction), driven
// by direction-known, the count of fresh downstream observations, and their
// recency. Below CONFIDENCE_FLOOR the entry is suppressed; with none surviving
// the whole Projection is null — silence over a guess (stories 5/6).

import { distanceMeters, DISPLACEMENT_THRESHOLD_M } from './anomalyRules';

// Distance cap on the Downstream set: a same-line/direction vehicle further
// behind than this is too far back to be attributed to this disruption.
export const MAX_DOWNSTREAM_DISTANCE_M = 3000;

// Nominal cruising speed used to convert a spatial gap (metres) into a coarse
// time headway (ms). With no GTFS static schedule or route polyline available
// (ADR 0005) there is no real headway to read; this is a deliberately rough
// proxy so "gap growth" can be expressed in the same unit as the stall duration.
export const REFERENCE_SPEED_MPS = 30000 / 3600; // ~30 km/h urban transit

// Confidence gate. A Projection below this floor is suppressed entirely
// (predictImpact drops the affected entry, and returns null when none survive):
// the app stays silent rather than guessing (PRD #136 stories 5/6). Confidence
// is a 0–1 score driven by direction-known, count of fresh downstream
// observations, and observation recency.
export const CONFIDENCE_FLOOR = 0.5;

// A downstream observation older than this (relative to `now`) is stale: it no
// longer counts toward the fresh-observation tally and decays the recency term.
export const OBSERVATION_FRESH_MS = 2 * 60 * 1000;

// Confidence weights (sum to 1): a known direction is the dominant signal, then
// having ≥2 fresh downstream observations, then how recent the latest one is.
const CONFIDENCE_WEIGHTS = { direction: 0.4, count: 0.35, recency: 0.25 };

const METERS_PER_DEG_LAT = 111320;

/**
 * Bucket a coarse delay magnitude into an honest, low-precision label. The
 * forecast never claims minute-level precision: a measured delay only ever
 * reads as ~5 / ~10 / 10+ minutes. This is presentation over the structured
 * `estimatedDelayMs` — predictImpact itself never produces display strings.
 *
 * @param {number|null|undefined} estimatedDelayMs
 * @returns {'~5 min'|'~10 min'|'10+ min'|null} null when the magnitude is unknown
 */
export function coarseDelayLabel(estimatedDelayMs) {
  if (!Number.isFinite(estimatedDelayMs)) return null;
  const minutes = estimatedDelayMs / 60000;
  if (minutes < 7.5) return '~5 min';
  if (minutes < 12.5) return '~10 min';
  return '10+ min';
}

/**
 * Map a 0–1 confidence to an honest, low-precision label for the presenter.
 * Below the floor never reaches the UI (predictImpact suppresses it), so the
 * label only ever reads 'medium' or 'high'. Rules never produce display strings.
 *
 * @param {number|null|undefined} confidence
 * @returns {'high'|'medium'|'low'|null} null when confidence is unknown
 */
export function confidenceLabel(confidence) {
  if (!Number.isFinite(confidence)) return null;
  if (confidence >= 0.8) return 'high';
  if (confidence >= CONFIDENCE_FLOOR) return 'medium';
  return 'low';
}

/**
 * Confidence (0–1) for one affected (line, direction): how much to trust the
 * forecast. Driven by (a) direction known, (b) count of fresh downstream
 * observations across the buffer window (≥2 ⇒ full credit, 1 ⇒ half), and
 * (c) recency of the most recent such observation. A direction-less or
 * single-stale basis falls below CONFIDENCE_FLOOR and is suppressed.
 */
function confidenceFor(downstreamVehicleIds, direction, snapshots, now) {
  const ids = new Set(downstreamVehicleIds);
  let freshCount = 0;
  let latestAge = Infinity;
  for (const snap of snapshots) {
    const present = (snap.vehicles ?? []).some((v) => ids.has(v.id));
    if (!present) continue;
    const age = now - snap.time;
    if (Number.isFinite(age) && age >= 0) {
      if (age <= OBSERVATION_FRESH_MS) freshCount += 1;
      if (age < latestAge) latestAge = age;
    }
  }

  const directionScore = direction != null ? 1 : 0;
  const countScore = freshCount >= 2 ? 1 : freshCount === 1 ? 0.5 : 0;
  const recencyScore = Number.isFinite(latestAge)
    ? Math.max(0, 1 - latestAge / OBSERVATION_FRESH_MS)
    : 0;

  return (
    CONFIDENCE_WEIGHTS.direction * directionScore +
    CONFIDENCE_WEIGHTS.count * countScore +
    CONFIDENCE_WEIGHTS.recency * recencyScore
  );
}

/**
 * Coarse "behind the disruption" test for a Downstream candidate. True when the
 * candidate has not yet passed the stall point along the stalled vehicle's
 * direction of travel: the local ground vector (candidate − stalled) has a
 * negative dot product with the stalled vehicle's bearing (a forward unit
 * vector, compass 0=N/90=E). When the bearing is unknown the heuristic cannot
 * orient itself, so it falls back to the distance cap alone (handled by the
 * caller) and reports the candidate as behind.
 */
export function isBehind(stalled, candidate) {
  if (!Number.isFinite(stalled.bearing)) return true;
  const toRad = (d) => (d * Math.PI) / 180;
  const brg = toRad(stalled.bearing);
  const forwardEast = Math.sin(brg);
  const forwardNorth = Math.cos(brg);
  const north = (candidate.latitude - stalled.latitude) * METERS_PER_DEG_LAT;
  const east =
    (candidate.longitude - stalled.longitude) *
    METERS_PER_DEG_LAT *
    Math.cos(toRad(stalled.latitude));
  return east * forwardEast + north * forwardNorth < 0;
}

function snapshotsOf(buffer) {
  // Tolerate either the observation buffer object or a plain snapshots array,
  // so the service stays trivially testable with fixture arrays.
  const snapshots = typeof buffer?.snapshots === 'function' ? buffer.snapshots() : buffer;
  return Array.isArray(snapshots) ? snapshots : [];
}

/**
 * Coarse delay magnitude for one affected (line, direction). First-order
 * estimate is the disruption's measured stall duration (from the stationary
 * Anomaly's evidence). When the buffer holds enough history for the nearest
 * Downstream vehicle, that is refined by the growth in the time-headway gap to
 * the vehicle ahead (the stall) across the window — and the larger of the two
 * wins. Without that history the estimate falls back to the stall duration alone.
 *
 * Returns structured inputs only (story 7); the presenter renders text.
 */
function estimateMagnitude(incident, stalled, downstreamVehicleIds, snapshots) {
  // First-order: the longest measured stall on this vehicle in the Incident.
  let measuredStationaryMs = null;
  for (const a of incident.anomalies ?? []) {
    if (a.vehicleId === stalled.id && Number.isFinite(a.measuredStationaryMs)) {
      measuredStationaryMs = Math.max(measuredStationaryMs ?? 0, a.measuredStationaryMs);
    }
  }

  // Headway proxy: track the nearest Downstream vehicle and the stall across the
  // window. The time-headway is the spatial gap converted at a nominal speed.
  const nearestId = downstreamVehicleIds[0];
  const headwaySeries = [];
  for (const snap of snapshots) {
    const vehicles = snap.vehicles ?? [];
    const ahead = vehicles.find((v) => v.id === stalled.id);
    const behind = vehicles.find((v) => v.id === nearestId);
    if (!ahead || !behind) continue;
    const gapM = distanceMeters(ahead.latitude, ahead.longitude, behind.latitude, behind.longitude);
    headwaySeries.push((gapM / REFERENCE_SPEED_MPS) * 1000);
  }

  // Enough history = the gap is observed in at least two snapshots, so a growth
  // can be measured rather than guessed.
  const enoughHistory = headwaySeries.length >= 2;
  const headwayBaselineMs = enoughHistory ? headwaySeries[0] : null;
  const gapGrowthMs = enoughHistory
    ? Math.max(0, headwaySeries[headwaySeries.length - 1] - headwaySeries[0])
    : null;

  const candidates = [];
  if (Number.isFinite(measuredStationaryMs)) candidates.push(measuredStationaryMs);
  if (enoughHistory) candidates.push(gapGrowthMs);
  const estimatedDelayMs = candidates.length > 0 ? Math.max(...candidates) : null;

  return { measuredStationaryMs, headwayBaselineMs, gapGrowthMs, estimatedDelayMs };
}

/**
 * Forecast the Expected impact of a geographic Incident, or null when there is
 * nothing honest to forecast.
 *
 * Returns null when: the Incident is absent, its subject is an operator (a feed
 * outage has no ground geometry), the buffer is empty, the stalled vehicle has
 * moved on (the disruption cleared) or has an unknown direction (it cannot be
 * scoped to one direction), or no same-line+direction Downstream vehicle exists.
 *
 * @param {object|null} incident
 * @param {object|object[]} buffer observation buffer (or snapshots array)
 * @param {number} now
 * @returns {{ incidentId: string, affected: object[] } | null}
 */
export function predictImpact(incident, buffer, now) {
  if (!incident || incident.subject?.kind !== 'geographic') return null;

  const snapshots = snapshotsOf(buffer);
  if (snapshots.length === 0) return null;
  const latest = snapshots[snapshots.length - 1];
  const vehicles = latest.vehicles ?? [];
  const byId = new Map();
  for (const v of vehicles) if (!byId.has(v.id)) byId.set(v.id, v);

  const affected = [];
  const seen = new Set();
  for (const vehicleId of incident.vehicleIds ?? []) {
    const stalled = byId.get(vehicleId);
    if (!stalled) continue; // gone from the feed — no current basis

    // Still stalled? If the vehicle has progressed beyond the displacement
    // threshold of the Incident's stall point, the disruption has cleared for
    // it and the forecast retracts.
    if (
      distanceMeters(
        stalled.latitude,
        stalled.longitude,
        incident.subject.latitude,
        incident.subject.longitude,
      ) > DISPLACEMENT_THRESHOLD_M
    ) {
      continue;
    }

    // A line with no known direction cannot be scoped to one direction, so it
    // cannot be projected (matching null===null would sweep in opposite-bound
    // traffic). Suppressed rather than guessed.
    if (stalled.direction == null) continue;

    const key = `${stalled.operator}|${stalled.line}|${stalled.direction}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const downstreamVehicleIds = vehicles
      .filter(
        (v) =>
          v.id !== stalled.id &&
          v.operator === stalled.operator &&
          v.line === stalled.line &&
          v.direction === stalled.direction &&
          isBehind(stalled, v) &&
          distanceMeters(
            stalled.latitude,
            stalled.longitude,
            v.latitude,
            v.longitude,
          ) <= MAX_DOWNSTREAM_DISTANCE_M,
      )
      // Nearest-first: the closest Downstream vehicle anchors the headway proxy.
      .sort(
        (a, b) =>
          distanceMeters(stalled.latitude, stalled.longitude, a.latitude, a.longitude) -
          distanceMeters(stalled.latitude, stalled.longitude, b.latitude, b.longitude),
      )
      .map((v) => v.id);

    if (downstreamVehicleIds.length === 0) continue;

    // Below the confidence floor there is nothing honest to say — drop the line
    // rather than guess (stories 5/6). A surviving entry carries its confidence.
    const confidence = confidenceFor(downstreamVehicleIds, stalled.direction, snapshots, now);
    if (confidence < CONFIDENCE_FLOOR) continue;

    const magnitude = estimateMagnitude(incident, stalled, downstreamVehicleIds, snapshots);

    affected.push({
      operator: stalled.operator,
      line: stalled.line,
      direction: stalled.direction,
      stalledVehicleId: stalled.id,
      downstreamVehicleIds,
      ...magnitude,
      confidence,
    });
  }

  if (affected.length === 0) return null;
  return { incidentId: incident.id, affected };
}
