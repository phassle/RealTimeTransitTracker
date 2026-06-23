// Incident evidence — pure aggregation over an Incident's Anomalies for the
// "Why flagged?" panel and the timeline. No free text, no LLM: every rendered
// claim is derived from structured Anomaly evidence (rule, threshold, measured
// value, affected vehicles/lines, start time) and traces back to a specific
// Anomaly on the timeline. See PRD #84 stories 16–18, CONTEXT.md § Operational
// picture.

function formatDurationMs(ms) {
  if (ms == null) return null;
  return `${Math.round(ms / 60000)} min`;
}

// Per-rule descriptor: how to label a rule and extract its threshold / measured
// value from an Anomaly's evidence. MVP carries the stationary rule only; new
// rules add an entry here without touching the presenter.
const RULE_DESCRIPTORS = {
  'stationary-on-active-trip': {
    label: 'Stationary on active trip',
    threshold: (a) => formatDurationMs(a.thresholdMs),
    measured: (a) => formatDurationMs(a.measuredStationaryMs),
  },
  'feed-fetch-failure': {
    label: 'Feed fetch failures',
    threshold: (a) => `${a.thresholdFailures} consecutive`,
    measured: (a) => `${a.measuredFailures} failed fetches`,
  },
  'feed-frozen-timestamps': {
    label: 'Feed data frozen',
    threshold: (a) => formatDurationMs(a.thresholdMs),
    measured: (a) => formatDurationMs(a.measuredFrozenMs),
  },
  'feed-vehicle-collapse': {
    label: 'Vehicle count collapse',
    threshold: (a) => `≤ ${Math.round(a.baselineCount * a.collapseRatio)} of ${a.baselineCount}`,
    measured: (a) => `${a.measuredCount} vehicles`,
  },
};

export function ruleLabel(ruleId) {
  return RULE_DESCRIPTORS[ruleId]?.label ?? ruleId;
}

function thresholdOf(a) {
  return RULE_DESCRIPTORS[a.ruleId]?.threshold?.(a) ?? null;
}

function measuredOf(a) {
  return RULE_DESCRIPTORS[a.ruleId]?.measured?.(a) ?? null;
}

/** Stable identity for an Anomaly within one Incident's timeline. Operator-
 * subject anomalies carry no vehicleId, so they key on the operator instead. */
export function anomalyKey(a) {
  return `${a.ruleId}:${a.vehicleId ?? a.operator}:${a.detectedAt}`;
}

/**
 * The Incident's Anomalies in chronological order (ascending by detection
 * time, falling back to start time).
 */
export function timelineAnomalies(incident) {
  const anomalies = incident?.anomalies ?? [];
  return [...anomalies].sort(
    (a, b) => (a.detectedAt ?? a.startedAt ?? 0) - (b.detectedAt ?? b.startedAt ?? 0),
  );
}

/** Per-Anomaly evidence row for the timeline. */
export function anomalyEvidence(a) {
  return {
    key: anomalyKey(a),
    ruleId: a.ruleId,
    ruleLabel: ruleLabel(a.ruleId),
    measured: measuredOf(a),
    vehicleId: a.vehicleId ?? null,
    line: a.line ?? null,
    detectedAt: a.detectedAt ?? a.startedAt ?? null,
  };
}

/**
 * Aggregate the Incident's Anomalies into one claim per contributing rule.
 * Each claim carries the rule, its threshold, the measured value, affected
 * vehicles and lines, and when it started — and references a representative
 * Anomaly (the most recent for that rule) so no claim is an orphan: activating
 * it highlights that Anomaly on the timeline.
 *
 * @param {object} incident
 * @returns {object[]} claims
 */
export function aggregateEvidence(incident) {
  const ordered = timelineAnomalies(incident);
  const byRule = new Map();
  for (const a of ordered) {
    if (!byRule.has(a.ruleId)) byRule.set(a.ruleId, []);
    byRule.get(a.ruleId).push(a);
  }

  const claims = [];
  for (const [ruleId, group] of byRule) {
    const representative = group[group.length - 1]; // latest → largest measured value
    const vehicles = [...new Set(group.map((a) => a.vehicleId).filter(Boolean))];
    const lines = [...new Set(group.map((a) => a.line).filter(Boolean))];
    const startedAt = Math.min(
      ...group.map((a) => a.startedAt ?? a.detectedAt).filter((t) => t != null),
    );
    claims.push({
      ruleId,
      ruleLabel: ruleLabel(ruleId),
      threshold: thresholdOf(representative),
      measured: measuredOf(representative),
      vehicles,
      lines,
      startedAt: Number.isFinite(startedAt) ? startedAt : null,
      anomalyKey: anomalyKey(representative),
    });
  }
  return claims;
}
