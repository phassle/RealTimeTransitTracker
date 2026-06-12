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
// anomalies from different vehicles fold into one Incident covering both.
//
// Stale (Slice 5): a geographic Incident whose source operator's feed has gone
// out (an operator-subject anomaly this poll) is flagged `stale` and frozen —
// its lifecycle is suspended so a quiet period can never auto-resolve it. When
// the feed recovers the flag clears and resolution resumes (PRD #84 story 14).

import { distanceMeters } from './anomalyRules';

export const PROXIMITY_THRESHOLD_M = 250;
export const QUIET_PERIOD_MS = 5 * 60 * 1000; // no anomaly for this long ⇒ resolved

function cloneIncident(i) {
  return {
    ...i,
    lines: [...i.lines],
    vehicleIds: [...i.vehicleIds],
    operators: [...(i.operators ?? [])],
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
      operators: [],
      startedAt: anomaly.startedAt,
      lastUpdate: anomaly.detectedAt ?? now,
      stale: false,
      anomalies: [],
    };
  }
  return {
    id: `stationary:${anomaly.vehicleId}:${anomaly.startedAt}`,
    status: 'open',
    subject: { kind: 'geographic', latitude: anomaly.latitude, longitude: anomaly.longitude },
    lines: [],
    vehicleIds: [],
    operators: [],
    startedAt: anomaly.startedAt,
    lastUpdate: anomaly.detectedAt ?? now,
    stale: false,
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
      if (a.operator && !incident.operators.includes(a.operator)) incident.operators.push(a.operator);
    }
  }

  // An operator whose feed is out this poll raised an operator-subject (feed
  // outage) anomaly above — those operators are "blind". A geographic Incident
  // whose source operator is blind is frozen and flagged stale: absence of data
  // is never evidence that a situation resolved (CONTEXT.md § Incident, PRD #84
  // story 14). The blind set is the live signal, so when the feed recovers (no
  // outage anomaly this poll) the flag clears and the lifecycle resumes.
  const blindOperators = new Set(
    (newAnomalies ?? []).filter(isOperatorAnomaly).map((a) => a.operator),
  );

  // Resolution pass: an open Incident that has gone quiet — no anomaly within
  // QUIET_PERIOD_MS of its lastUpdate — resolves. Incidents that absorbed a
  // fresh anomaly above kept their lastUpdate current and so stay open. A stale
  // (blind-source) geographic Incident is frozen instead — never auto-resolved.
  for (const incident of incidents) {
    if (incident.status !== 'open') continue;
    const stale =
      incident.subject.kind === 'geographic' &&
      (incident.operators ?? []).some((op) => blindOperators.has(op));
    incident.stale = stale;
    if (stale) continue; // frozen on a blind feed — never auto-resolve
    if (now - incident.lastUpdate >= QUIET_PERIOD_MS) {
      incident.status = 'resolved';
      incident.resolvedAt = now;
    }
  }

  return incidents;
}
