// Scenario impact — pure blast-radius derivation for a what-if area closure.
//
// A Scenario is the user-initiated sibling of a Projection (ADR 0005): a
// transient, forward-looking derivation that lives entirely OUTSIDE the
// Anomaly→Incident pipeline. It produces no Anomaly, never touches
// clusterIncidents, creates no Incident / Inbox row / timeline entry, makes no
// new feed calls, and is never persisted to a Recording. Where a Projection
// extrapolates from a real detected disruption, a Scenario invents the
// premise — an area declared closed that is NOT actually happening — so every
// surface must read as a hypothesis (CONTEXT.md § Scenario, PRD #143).
//
// The area is a bounding box (rectangle), not a free polygon, so "inside" is a
// simple point-in-bbox test. Slice 1 (issue #144) computes only the "in-area
// now" population: vehicles whose latest observed position is inside the box.
// The transited-window population and service-intensity ranking are Slice 2.

// Central-Slussen closure box (WGS84). A rectangle over the Slussen interchange
// in central Stockholm — enough to catch the buses and metro running through it
// without reaching the neighbouring hubs.
export const SLUSSEN_AREA = { south: 59.317, west: 18.065, north: 59.323, east: 18.078 };

/**
 * Build a preset Scenario. Presets are demo content (like Injected Incidents),
 * so they carry `demo: true` and `source: 'preset'`; the two "not real" axes are
 * orthogonal — every Scenario is a hypothesis, only presets are demo-labelled.
 *
 * @param {string} id — caller-supplied transient id (never persisted)
 * @returns {{ id: string, name: string, source: 'preset', demo: true, area: object }}
 */
export function buildPresetScenario(id) {
  return {
    id,
    name: 'close Slussen',
    source: 'preset',
    demo: true,
    area: SLUSSEN_AREA,
  };
}

function snapshotsOf(buffer) {
  // Tolerate either the observation buffer object or a plain snapshots array,
  // so the service stays trivially testable with fixture arrays (mirrors
  // etaProjection.snapshotsOf).
  const snapshots = typeof buffer?.snapshots === 'function' ? buffer.snapshots() : buffer;
  return Array.isArray(snapshots) ? snapshots : [];
}

function isInBox(vehicle, area) {
  const { latitude: lat, longitude: lng } = vehicle;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= area.south && lat <= area.north && lng >= area.west && lng <= area.east;
}

const EMPTY_IMPACT = { lines: [], operators: [], inAreaVehicleIds: [] };

/**
 * Compute the blast radius of a Scenario's area closure against the live
 * observation buffer. Slice 1: the "in-area now" population only — vehicles
 * whose latest position (the last snapshot in the window) is inside the box —
 * aggregated into affected lines, operators, and the in-area vehicle ids.
 *
 * Returns structured data only; the presenter renders text. Never throws on an
 * empty buffer / empty area — an empty impact is a valid result.
 *
 * @param {{ area: { south: number, west: number, north: number, east: number } }|null} scenario
 * @param {object|object[]} buffer observation buffer (or snapshots array)
 * @param {number} now — reserved for the Slice 2 transited-window read
 * @returns {{ lines: { line: string, operator: string }[], operators: string[], inAreaVehicleIds: string[] }}
 */
// eslint-disable-next-line no-unused-vars
export function computeScenarioImpact(scenario, buffer, now) {
  if (!scenario?.area) return { ...EMPTY_IMPACT };

  const snapshots = snapshotsOf(buffer);
  if (snapshots.length === 0) return { ...EMPTY_IMPACT };

  const latest = snapshots[snapshots.length - 1];
  const vehicles = latest.vehicles ?? [];

  const inAreaVehicleIds = [];
  const seenVehicles = new Set();
  const lines = [];
  const seenLines = new Set();
  const operators = [];
  const seenOperators = new Set();

  for (const v of vehicles) {
    if (!isInBox(v, scenario.area)) continue;

    if (!seenVehicles.has(v.id)) {
      seenVehicles.add(v.id);
      inAreaVehicleIds.push(v.id);
    }

    const lineKey = `${v.operator}|${v.line}`;
    if (v.line != null && !seenLines.has(lineKey)) {
      seenLines.add(lineKey);
      lines.push({ line: v.line, operator: v.operator });
    }

    if (v.operator != null && !seenOperators.has(v.operator)) {
      seenOperators.add(v.operator);
      operators.push(v.operator);
    }
  }

  return { lines, operators, inAreaVehicleIds };
}
