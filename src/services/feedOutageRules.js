// Feed outage rules — pure functions (snapshots, now) → Anomaly[].
//
// A Feed outage is an operator-level data problem, not on-the-ground traffic.
// Three signals raise an operator-subject Anomaly (CONTEXT.md § Feed outage):
//
//   1. feed-fetch-failure       — repeated failed fetches for an operator.
//   2. feed-frozen-timestamps   — the feed responds but its data timestamps
//                                 have stopped advancing (technically "up", dead).
//   3. feed-vehicle-collapse    — a sudden collapse in vehicle count against
//                                 the recent baseline (partial feed failure).
//
// These read the per-operator fetch outcomes recorded in the observation buffer
// each poll ({ operator, ok, vehicleCount, dataTimestamp }) — no new feed calls,
// the rate-limit budget is unchanged. Only WATCHED operators are considered: an
// operator is watched iff it appears in the latest snapshot's feeds. Absence of
// polling is never evidence of an outage (PRD #84 stories 9–13).
//
// Anomalies carry no ground geometry (no latitude/vehicleId): operator-subject.
// Thresholds are named constants to be calibrated against the live feed.

export const FETCH_FAILURE_STREAK = 3;              // consecutive failed fetches ⇒ outage
export const FROZEN_FEED_MS = 3 * 60 * 1000;        // data timestamp unchanged this long ⇒ frozen
export const VEHICLE_COLLAPSE_RATIO = 0.2;          // count ≤ this × baseline ⇒ collapse
export const VEHICLE_COLLAPSE_MIN_BASELINE = 10;    // ignore collapse below this baseline (noise)

/** Watched operators: those present in the latest snapshot's feeds. */
function watchedOperators(latest) {
  return new Set((latest.feeds ?? []).map((f) => f.operator));
}

/** The operator's feed outcome series in chronological order (only where present). */
function feedSeries(snapshots, operator) {
  const series = [];
  for (const s of snapshots) {
    const f = (s.feeds ?? []).find((x) => x.operator === operator);
    if (f) series.push({ time: s.time, ...f });
  }
  return series;
}

function detectFetchFailure(series, operator, now) {
  const latest = series[series.length - 1];
  if (!latest || latest.ok) return null; // recovered feeds never flag

  let streak = 0;
  let firstFailureTime = latest.time;
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].ok) break;
    streak++;
    firstFailureTime = series[i].time;
  }

  if (streak < FETCH_FAILURE_STREAK) return null;
  return {
    ruleId: 'feed-fetch-failure',
    subjectKind: 'operator',
    operator,
    measuredFailures: streak,
    thresholdFailures: FETCH_FAILURE_STREAK,
    startedAt: firstFailureTime,
    detectedAt: now,
  };
}

function detectFrozenTimestamps(series, operator, now) {
  const latest = series[series.length - 1];
  if (!latest || !latest.ok || latest.dataTimestamp == null) return null;

  let startedAt = latest.time;
  for (let i = series.length - 1; i >= 0; i--) {
    if (!series[i].ok || series[i].dataTimestamp !== latest.dataTimestamp) break;
    startedAt = series[i].time;
  }

  const frozenMs = now - startedAt;
  if (frozenMs < FROZEN_FEED_MS) return null;
  return {
    ruleId: 'feed-frozen-timestamps',
    subjectKind: 'operator',
    operator,
    measuredFrozenMs: frozenMs,
    thresholdMs: FROZEN_FEED_MS,
    frozenDataTimestamp: latest.dataTimestamp,
    startedAt,
    detectedAt: now,
  };
}

function detectVehicleCollapse(series, operator, now) {
  const latest = series[series.length - 1];
  if (!latest || !latest.ok) return null;

  const baseline = Math.max(...series.filter((f) => f.ok).map((f) => f.vehicleCount ?? 0));
  if (baseline < VEHICLE_COLLAPSE_MIN_BASELINE) return null;
  if (latest.vehicleCount > baseline * VEHICLE_COLLAPSE_RATIO) return null;

  return {
    ruleId: 'feed-vehicle-collapse',
    subjectKind: 'operator',
    operator,
    measuredCount: latest.vehicleCount,
    baselineCount: baseline,
    collapseRatio: VEHICLE_COLLAPSE_RATIO,
    startedAt: latest.time,
    detectedAt: now,
  };
}

/**
 * @param {{ time: number, feeds: object[] }[]} snapshots chronological history
 * @param {number} now
 * @returns {object[]} operator-subject anomalies
 */
export function detectFeedOutageAnomalies(snapshots, now) {
  if (!snapshots || snapshots.length === 0) return [];
  const latest = snapshots[snapshots.length - 1];

  const anomalies = [];
  for (const operator of watchedOperators(latest)) {
    const series = feedSeries(snapshots, operator);
    const fetchFailure = detectFetchFailure(series, operator, now);
    if (fetchFailure) anomalies.push(fetchFailure);
    const frozen = detectFrozenTimestamps(series, operator, now);
    if (frozen) anomalies.push(frozen);
    const collapse = detectVehicleCollapse(series, operator, now);
    if (collapse) anomalies.push(collapse);
  }
  return anomalies;
}
