// Incident clustering — pure function (existingIncidents, newAnomalies, now) → incidents.
//
// Folds related Anomalies into Incidents: an ongoing situation with a lifecycle
// (open → resolved) and a subject (geographic area or operator). One stationary
// bus re-detected every poll is ONE Incident accumulating Anomalies on its
// timeline — not a new inbox row per detection. See CONTEXT.md § Operational
// picture and ADR 0003.
//
// Slice 1 scope: geographic subjects from the stationary rule, folded by vehicle
// identity (and nearby proximity). Cross-rule spatial merge, operator subjects,
// quiet-period resolution and the stale flag are later slices.

import { distanceMeters } from './anomalyRules';

export const PROXIMITY_THRESHOLD_M = 250;

function cloneIncident(i) {
  return {
    ...i,
    lines: [...i.lines],
    vehicleIds: [...i.vehicleIds],
    anomalies: [...i.anomalies],
    subject: { ...i.subject },
  };
}

function matches(incident, anomaly) {
  if (incident.status !== 'open') return false;
  if (incident.vehicleIds.includes(anomaly.vehicleId)) return true;
  if (incident.subject.kind === 'geographic') {
    return (
      distanceMeters(
        incident.subject.latitude,
        incident.subject.longitude,
        anomaly.latitude,
        anomaly.longitude,
      ) <= PROXIMITY_THRESHOLD_M
    );
  }
  return false;
}

/**
 * @param {object[]} existingIncidents
 * @param {object[]} newAnomalies
 * @param {number} now
 * @returns {object[]} the updated incident list
 */
export function clusterIncidents(existingIncidents, newAnomalies, now) {
  const incidents = (existingIncidents ?? []).map(cloneIncident);

  for (const a of newAnomalies ?? []) {
    let incident = incidents.find((i) => matches(i, a));

    if (!incident) {
      incident = {
        id: `stationary:${a.vehicleId}`,
        status: 'open',
        subject: { kind: 'geographic', latitude: a.latitude, longitude: a.longitude },
        lines: [],
        vehicleIds: [],
        startedAt: a.startedAt,
        lastUpdate: a.detectedAt ?? now,
        anomalies: [],
      };
      incidents.push(incident);
    }

    incident.anomalies.push(a);
    incident.lastUpdate = a.detectedAt ?? now;
    incident.subject.latitude = a.latitude;
    incident.subject.longitude = a.longitude;
    if (!incident.vehicleIds.includes(a.vehicleId)) incident.vehicleIds.push(a.vehicleId);
    if (a.line && !incident.lines.includes(a.line)) incident.lines.push(a.line);
  }

  return incidents;
}
