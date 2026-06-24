import { AIRPLANES_LIVE_BASE } from '../config/endpoints.js';

// airplanes.live caps the point-query radius at 250 nautical miles.
const MAX_RADIUS_NM = 250;

// Aircraft are gated on zoom: below this level no aircraft are fetched or shown,
// so the country-level view isn't flooded with planes and the 1 req/s budget is
// spent only when aircraft are useful (PRD #165, user stories 5 & 7).
export const AIRCRAFT_MIN_ZOOM = 8;

// 1 nautical mile = 1.852 km; 1° latitude ≈ 111.32 km.
const KM_PER_DEGREE_LAT = 111.32;
const KM_PER_NM = 1.852;

/**
 * Derive an airplanes.live point query from the current viewport, gated on zoom.
 *
 * Below {@link AIRCRAFT_MIN_ZOOM}, or with no bounds yet, returns `null` so the
 * caller issues no request at all and shows no aircraft. At/above the threshold,
 * the query centre is the viewport midpoint and the radius is the half-diagonal
 * (centre → corner) in nautical miles, clamped to {@link MAX_RADIUS_NM} — the
 * source's maximum (PRD #165, user story 5).
 *
 * Uses an equirectangular approximation for the half-diagonal, which is ample
 * for sizing a fetch radius at these latitudes.
 *
 * @param {{ south: number, west: number, north: number, east: number } | null} bounds
 * @param {number} zoom
 * @returns {{ lat: number, lon: number, radius: number } | null}
 */
export function deriveAircraftQuery(bounds, zoom) {
  if (!bounds || zoom < AIRCRAFT_MIN_ZOOM) return null;

  const { south, west, north, east } = bounds;
  const lat = (south + north) / 2;
  const lon = (west + east) / 2;

  const latSpanKm = ((north - south) / 2) * KM_PER_DEGREE_LAT;
  const lonSpanKm =
    ((east - west) / 2) * KM_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);
  const halfDiagonalNm = Math.sqrt(latSpanKm ** 2 + lonSpanKm ** 2) / KM_PER_NM;

  return { lat, lon, radius: Math.min(halfDiagonalNm, MAX_RADIUS_NM) };
}

/**
 * Pure mapping: airplanes.live `ac[]` entries → the existing Vehicle shape, so
 * aircraft flow through the unchanged marker pipeline (PRD #165).
 *
 * An Aircraft is a Vehicle with no operator (CONTEXT.md): `line` carries the
 * trimmed callsign, `bearing = track`, `speed = gs`. `mode` is `helicopter`
 * when the source category is A7 (rotorcraft), otherwise `aircraft`. Extra
 * fields { type, reg, altitude } drive the identifying popup. Entries without a
 * current position are dropped, mirroring the GTFS-RT fetcher.
 *
 * @param {object[]} ac
 * @returns {object[]}
 */
export function mapAircraft(ac) {
  if (!Array.isArray(ac)) return [];

  const vehicles = [];
  for (const entry of ac) {
    if (!entry || entry.lat == null || entry.lon == null) continue;
    vehicles.push({
      id: `air:${entry.hex}`,
      line: (entry.flight ?? '').trim(),
      lineName: '',
      mode: entry.category === 'A7' ? 'helicopter' : 'aircraft',
      latitude: entry.lat,
      longitude: entry.lon,
      bearing: entry.track ?? 0,
      speed: entry.gs ?? 0,
      // Popup extras — identify the flight.
      type: entry.desc,
      reg: entry.r,
      altitude: entry.alt_baro,
    });
  }
  return vehicles;
}

/**
 * Fetch live aircraft around a point and map them into Vehicles.
 *
 * Aircraft are non-essential overlay data: a failed or malformed fetch is
 * tolerated silently (resolves to []), so transit Vehicles are unaffected and
 * no error is surfaced (PRD #165). Radius is capped at {@link MAX_RADIUS_NM}.
 *
 * @param {{ lat: number, lon: number, radius: number }} params
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchAircraft({ lat, lon, radius }, { fetchImpl = fetch } = {}) {
  const cappedRadius = Math.min(radius, MAX_RADIUS_NM);
  const url = `${AIRPLANES_LIVE_BASE}/point/${lat}/${lon}/${cappedRadius}`;
  try {
    const response = await fetchImpl(url);
    if (!response.ok) return [];
    const data = await response.json();
    return mapAircraft(data?.ac);
  } catch {
    return [];
  }
}
