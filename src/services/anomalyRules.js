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

// Dwell-spot learning (Slice 2). A Dwell spot is a location where standing
// still is normal — terminals, depots, layover points — learned from the
// session's own observation history: many *distinct* vehicles standing at the
// same place ⇒ a suppression zone. Re-learned each session, imperfect in the
// first minutes (ADR 0003). Thresholds are named constants to be calibrated.
export const DWELL_RADIUS_M = 50;            // standing samples within this group into one spot
export const DWELL_MIN_DISTINCT_VEHICLES = 3; // "many" distinct vehicles ⇒ habitual stop, not a stall

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

function indexVehiclesById(vehicles) {
  const byId = new Map();
  for (const vehicle of vehicles) {
    if (!byId.has(vehicle.id)) {
      byId.set(vehicle.id, vehicle);
    }
  }
  return byId;
}

function createVehicleLookup(snapshots) {
  const indexedSnapshots = new Map();
  const linearLookupSnapshots = new Set();

  return (snapshotIndex, vehicleId) => {
    const indexed = indexedSnapshots.get(snapshotIndex);
    if (indexed) return indexed.get(vehicleId);

    if (!linearLookupSnapshots.has(snapshotIndex)) {
      linearLookupSnapshots.add(snapshotIndex);
      return snapshots[snapshotIndex].vehicles.find((x) => x.id === vehicleId);
    }

    const byId = indexVehiclesById(snapshots[snapshotIndex].vehicles);
    indexedSnapshots.set(snapshotIndex, byId);
    return byId.get(vehicleId);
  };
}

/**
 * Learn Dwell spots from the observation history. A vehicle observed within the
 * displacement threshold of its own previous observation is "standing" at that
 * point; standing samples are clustered spatially, and any cluster visited by
 * at least DWELL_MIN_DISTINCT_VEHICLES distinct vehicles becomes a Dwell spot at
 * its centroid. A single vehicle stuck in one place (a real stall) only ever
 * reaches a distinct-vehicle count of one, so it is never learned as a Dwell
 * spot — the distinct-vehicle count is what separates a habitual stop from a
 * disruption.
 *
 * Pure derivation over the buffer; no static dataset (CONTEXT.md § Dwell spot).
 *
 * @param {{ time: number, vehicles: object[] }[]} snapshots chronological history
 * @param {{ radiusM?: number, minDistinctVehicles?: number }} [opts]
 * @returns {{ latitude: number, longitude: number, distinctVehicles: number }[]}
 */
export function learnDwellSpots(
  snapshots,
  { radiusM = DWELL_RADIUS_M, minDistinctVehicles = DWELL_MIN_DISTINCT_VEHICLES } = {},
) {
  if (!snapshots || snapshots.length < 2) return [];

  // Standing samples: a vehicle within the displacement threshold of where the
  // same vehicle was last seen is standing still at that location.
  const lastSeen = new Map();
  const samples = [];
  for (const snap of snapshots) {
    for (const v of snap.vehicles) {
      if (!hasCoords(v)) continue;
      const prev = lastSeen.get(v.id);
      if (
        prev &&
        distanceMeters(v.latitude, v.longitude, prev.latitude, prev.longitude) <= DISPLACEMENT_THRESHOLD_M
      ) {
        samples.push({ vehicleId: v.id, latitude: v.latitude, longitude: v.longitude });
      }
      lastSeen.set(v.id, { latitude: v.latitude, longitude: v.longitude });
    }
  }

  // Greedy spatial clustering of standing samples around moving centroids.
  const clusters = [];
  for (const s of samples) {
    let target = clusters.find(
      (c) => distanceMeters(s.latitude, s.longitude, c.latitude, c.longitude) <= radiusM,
    );
    if (!target) {
      target = { latSum: 0, lonSum: 0, count: 0, latitude: s.latitude, longitude: s.longitude, vehicleIds: new Set() };
      clusters.push(target);
    }
    target.latSum += s.latitude;
    target.lonSum += s.longitude;
    target.count += 1;
    target.latitude = target.latSum / target.count;
    target.longitude = target.lonSum / target.count;
    target.vehicleIds.add(s.vehicleId);
  }

  return clusters
    .filter((c) => c.vehicleIds.size >= minDistinctVehicles)
    .map((c) => ({ latitude: c.latitude, longitude: c.longitude, distinctVehicles: c.vehicleIds.size }));
}

function atDwellSpot(v, dwellSpots, radiusM) {
  return dwellSpots.some(
    (d) => distanceMeters(v.latitude, v.longitude, d.latitude, d.longitude) <= radiusM,
  );
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
 * Detections at a learned Dwell spot are suppressed, not surfaced (Slice 2):
 * a vehicle standing within DWELL_RADIUS_M of any supplied Dwell spot is a bus
 * legitimately laying over, not a disruption.
 *
 * @param {{ time: number, vehicles: object[] }[]} snapshots chronological history
 * @param {number} now
 * @param {{ dwellSpots?: {latitude:number, longitude:number}[] }} [opts]
 * @returns {object[]} anomalies
 */
export function detectStationaryAnomalies(snapshots, now, { dwellSpots = [] } = {}) {
  if (!snapshots || snapshots.length === 0) return [];

  const latest = snapshots[snapshots.length - 1];
  const vehicleAt = createVehicleLookup(snapshots);
  const anomalies = [];

  for (const v of latest.vehicles) {
    if (!onActiveTrip(v) || !hasCoords(v)) continue;
    if (atDwellSpot(v, dwellSpots, DWELL_RADIUS_M)) continue;

    let startedAt = latest.time;
    for (let i = snapshots.length - 2; i >= 0; i--) {
      const prev = vehicleAt(i, v.id);
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
