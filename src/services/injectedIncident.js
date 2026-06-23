// Injected (demo) Incident — synthetic anomalies inserted on demand so the demo
// is reproducible without depending on real-world luck. They enter through the
// real clustering seam (clusterIncidents) carrying a `demo` marker that survives
// into every presenter, then flow through the real inbox, map, panel, timeline
// and webcam logic exactly like a real detection. All live, non-injected data
// stays real. See CONTEXT.md § Injected Incident and PRD #84 stories 26–28.

import { STATIONARY_DURATION_MS, DISPLACEMENT_THRESHOLD_M } from './anomalyRules';

// A central-Stockholm scene: two buses stranded close together (within the
// clustering proximity) on active trips. Coordinates put the subject near the
// curated webcams so the nearby-webcam panel has something to show.
const DEMO_VEHICLES = [
  { id: 'demo:bus-1', operator: 'sl', line: '4', tripId: 'demo-trip-1', latitude: 59.3325, longitude: 18.0649 },
  { id: 'demo:bus-2', operator: 'sl', line: '72', tripId: 'demo-trip-2', latitude: 59.3331, longitude: 18.0652 },
];

// How long the demo vehicles are presented as having been stationary — past the
// threshold so the scenario reads as a genuine disruption.
const DEMO_STATIONARY_MS = STATIONARY_DURATION_MS + 3 * 60 * 1000;

/**
 * Build the synthetic stationary anomalies for an Injected Incident at `now`.
 * Each carries `demo: true` plus the same structured evidence a real stationary
 * detection would, so the Why-flagged panel and timeline render unchanged.
 *
 * @param {number} now
 * @returns {object[]} demo-marked anomalies
 */
export function buildInjectedAnomalies(now) {
  return DEMO_VEHICLES.map((v) => ({
    ruleId: 'stationary-on-active-trip',
    vehicleId: v.id,
    operator: v.operator,
    line: v.line,
    tripId: v.tripId,
    latitude: v.latitude,
    longitude: v.longitude,
    measuredStationaryMs: DEMO_STATIONARY_MS,
    thresholdMs: STATIONARY_DURATION_MS,
    displacementThresholdM: DISPLACEMENT_THRESHOLD_M,
    startedAt: now - DEMO_STATIONARY_MS,
    detectedAt: now,
    demo: true,
  }));
}
