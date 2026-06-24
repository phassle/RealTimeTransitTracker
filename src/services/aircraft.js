import { AIRPLANES_LIVE_BASE } from '../config/endpoints.js';

// airplanes.live caps the point-query radius at 250 nautical miles.
const MAX_RADIUS_NM = 250;

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
