// Expected impact Projection — pure forward-looking derivation for a geographic
// Incident. A Projection is NOT an Anomaly: it forecasts who is *about to* be
// affected by a known disruption, it produces no Anomaly, never touches the
// Anomaly→Incident clustering seam, and is recomputed transiently per poll for
// the selected Incident only (see ADR 0005, CONTEXT.md § Projection).
//
// Slice 1 (walking skeleton): the simplest line+direction match. For each
// stalled vehicle of the Incident, the Downstream vehicles are the others in
// the latest snapshot sharing its `(operator, line, direction)` triple. The
// precise "behind" heuristic, delay magnitude, and confidence gating arrive in
// later slices of PRD #136.

import { distanceMeters, DISPLACEMENT_THRESHOLD_M } from './anomalyRules';

function latestSnapshot(buffer) {
  // Tolerate either the observation buffer object or a plain snapshots array,
  // so the service stays trivially testable with fixture arrays.
  const snapshots = typeof buffer?.snapshots === 'function' ? buffer.snapshots() : buffer;
  if (!Array.isArray(snapshots) || snapshots.length === 0) return null;
  return snapshots[snapshots.length - 1];
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

  const latest = latestSnapshot(buffer);
  if (!latest) return null;
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
          v.direction === stalled.direction,
      )
      .map((v) => v.id);

    if (downstreamVehicleIds.length === 0) continue;

    affected.push({
      operator: stalled.operator,
      line: stalled.line,
      direction: stalled.direction,
      stalledVehicleId: stalled.id,
      downstreamVehicleIds,
    });
  }

  if (affected.length === 0) return null;
  return { incidentId: incident.id, affected };
}
