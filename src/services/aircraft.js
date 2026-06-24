// Aircraft mapping service — the airspace counterpart to the GTFS-RT fetcher
// (trafiklab.js). Aircraft come from airplanes.live: unauthenticated, CORS-open,
// no proxy, no backend (ADR 0001). An Aircraft is a Vehicle with no operator
// (see CONTEXT.md): `line` carries the callsign; the popup also shows type,
// registration and altitude.

import { AIRPLANES_LIVE_BASE } from '../config/endpoints.js';

// airplanes.live caps the point-query radius at 250 nautical miles.
export const AIRPLANES_LIVE_MAX_RADIUS_NM = 250;

// A7 = rotorcraft (verified live: a Bell 429 returned category "A7").
// Every other category — and a missing one — is a fixed-wing aircraft.
function categoryToMode(category) {
  return category === 'A7' ? 'helicopter' : 'aircraft';
}

/**
 * Pure mapping of an airplanes.live `ac[]` array into the existing Vehicle
 * shape, so aircraft flow through the unchanged marker pipeline. Entries with
 * no current position are dropped (mirrors the GTFS fetcher).
 *
 * @param {Array<object>} ac
 * @returns {object[]}
 */
export function mapAircraft(ac) {
  if (!Array.isArray(ac)) return [];
  const vehicles = [];
  for (const a of ac) {
    if (a == null) continue;
    if (a.lat == null || a.lon == null) continue;
    vehicles.push({
      id: `air:${a.hex}`,
      // operator deliberately absent — an Aircraft has no operator.
      line: typeof a.flight === 'string' ? a.flight.trim() : '',
      lineName: '',
      mode: categoryToMode(a.category),
      latitude: a.lat,
      longitude: a.lon,
      bearing: a.track ?? 0,
      speed: a.gs ?? 0,
      // Extras for the popup.
      type: a.desc,
      reg: a.r,
      altitude: a.alt_baro,
    });
  }
  return vehicles;
}

/**
 * Fetch the current viewport from airplanes.live and map it into Vehicles.
 * Tolerates every failure silently (aircraft are non-essential overlay data):
 * an unreachable, non-ok, or malformed response resolves to `[]`, so transit
 * Vehicles are unaffected and no error is surfaced.
 *
 * @param {{ lat: number, lon: number, radius: number }} query
 * @returns {Promise<object[]>}
 */
export async function fetchAircraft({ lat, lon, radius }) {
  const cappedRadius = Math.min(radius, AIRPLANES_LIVE_MAX_RADIUS_NM);
  const url = `${AIRPLANES_LIVE_BASE}/point/${lat}/${lon}/${cappedRadius}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data?.ac)) return [];
    return mapAircraft(data.ac);
  } catch {
    return [];
  }
}
