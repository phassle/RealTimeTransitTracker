// Incident clustering — pure function (existingIncidents, newAnomalies, now) → incidents.
//
// Folds related Anomalies into Incidents: an ongoing situation with a lifecycle
// (open → resolved) and a subject (geographic area or operator). One stationary
// bus re-detected every poll is ONE Incident accumulating Anomalies on its
// timeline — not a new inbox row per detection. See CONTEXT.md § Operational
// picture and ADR 0003.
//
// Lifecycle (Slice 3): an open Incident whose Anomalies stop recurring resolves
// automatically once a quiet period elapses (no new anomaly within
// QUIET_PERIOD_MS of its lastUpdate). Resolved Incidents are frozen — they no
// longer absorb anomalies — so a recurrence of the same situation surfaces as a
// fresh open Incident (with a distinct id) rather than reopening the old row.
// Geographic subjects merge by vehicle identity OR spatial proximity, so nearby
// anomalies from different vehicles fold into one Incident covering both. The
// stale flag (frozen on a blind feed) is a later slice.

import { distanceMeters } from './anomalyRules';

export const PROXIMITY_THRESHOLD_M = 250;
export const QUIET_PERIOD_MS = 5 * 60 * 1000; // no anomaly for this long ⇒ resolved

function cloneIncident(i) {
  return {
    ...i,
    lines: [...i.lines],
    vehicleIds: [...i.vehicleIds],
    anomalies: [...i.anomalies],
    subject: { ...i.subject },
  };
}

function isOperatorAnomaly(anomaly) {
  return anomaly.subjectKind === 'operator';
}

function matches(incident, anomaly) {
  if (incident.status !== 'open') return false;

  // Operator-subject (feed outage) anomalies fold by operator identity ONLY —
  // they carry no ground geometry, so they never merge with geographic
  // Incidents by proximity, and vice versa.
  if (isOperatorAnomaly(anomaly)) {
    return incident.subject.kind === 'operator' && incident.subject.operator === anomaly.operator;
  }
  if (incident.subject.kind !== 'geographic') return false;

  if (incident.vehicleIds.includes(anomaly.vehicleId)) return true;
  return (
    distanceMeters(
      incident.subject.latitude,
      incident.subject.longitude,
      anomaly.latitude,
      anomaly.longitude,
    ) <= PROXIMITY_THRESHOLD_M
  );
}

function newIncidentFor(anomaly, now) {
  if (isOperatorAnomaly(anomaly)) {
    return {
      // startedAt keeps the id unique across recurrences of the same operator's outage.
      id: `feed-outage:${anomaly.operator}:${anomaly.startedAt}`,
      status: 'open',
      subject: { kind: 'operator', operator: anomaly.operator },
      lines: [],
      vehicleIds: [],
      startedAt: anomaly.startedAt,
      lastUpdate: anomaly.detectedAt ?? now,
      anomalies: [],
    };
  }
  return {
    id: `stationary:${anomaly.vehicleId}:${anomaly.startedAt}`,
    status: 'open',
    subject: { kind: 'geographic', latitude: anomaly.latitude, longitude: anomaly.longitude },
    lines: [],
    vehicleIds: [],
    startedAt: anomaly.startedAt,
    lastUpdate: anomaly.detectedAt ?? now,
    anomalies: [],
  };
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
      incident = newIncidentFor(a, now);
      incidents.push(incident);
    }

    incident.anomalies.push(a);
    incident.lastUpdate = a.detectedAt ?? now;
    // Operator-subject Incidents carry no ground geometry, lines, or vehicles —
    // they are presented as data problems, not traffic on the ground.
    if (incident.subject.kind === 'geographic') {
      incident.subject.latitude = a.latitude;
      incident.subject.longitude = a.longitude;
      if (!incident.vehicleIds.includes(a.vehicleId)) incident.vehicleIds.push(a.vehicleId);
      if (a.line && !incident.lines.includes(a.line)) incident.lines.push(a.line);
    }
  }

  // Resolution pass: an open Incident that has gone quiet — no anomaly within
  // QUIET_PERIOD_MS of its lastUpdate — resolves. Incidents that absorbed a
  // fresh anomaly above kept their lastUpdate current and so stay open.
  for (const incident of incidents) {
    if (incident.status === 'open' && now - incident.lastUpdate >= QUIET_PERIOD_MS) {
      incident.status = 'resolved';
      incident.resolvedAt = now;
    }
  }

  return incidents;
}
