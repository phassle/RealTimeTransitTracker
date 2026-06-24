import { KM_PER_DEGREE_LAT, KM_PER_NM } from './aircraft';

/**
 * Dead-reckon an aircraft's position forward from its last fix (idea #51).
 *
 * airplanes.live reports each aircraft's ground track (`bearing`, degrees) and
 * ground speed (`speed`, in **knots** = nautical miles/hour). Between the
 * deliberately-slow real polls we project the marker along that track at that
 * speed, so it glides instead of jumping (or flickering out under throttle).
 *
 * Equirectangular projection — the same approximation `deriveAircraftQuery`
 * uses, ample at these latitudes for a sub-minute extrapolation. A non-finite
 * or zero speed (e.g. a hovering helicopter) leaves the position unchanged.
 *
 * @param {{ latitude: number, longitude: number, bearing?: number, speed?: number }} vehicle
 * @param {number} elapsedSeconds  seconds since the last real fix
 * @returns {[number, number]} predicted [latitude, longitude]
 */
export function projectPosition({ latitude, longitude, bearing = 0, speed = 0 }, elapsedSeconds) {
  if (!Number.isFinite(speed) || speed <= 0 || !Number.isFinite(bearing) || !(elapsedSeconds > 0)) {
    return [latitude, longitude];
  }
  const distanceKm = speed * (elapsedSeconds / 3600) * KM_PER_NM;
  const bearingRad = (bearing * Math.PI) / 180;
  const dLat = (distanceKm * Math.cos(bearingRad)) / KM_PER_DEGREE_LAT;
  const dLon =
    (distanceKm * Math.sin(bearingRad)) /
    (KM_PER_DEGREE_LAT * Math.cos((latitude * Math.PI) / 180));
  return [latitude + dLat, longitude + dLon];
}

/**
 * Project every aircraft forward by `elapsedSeconds`, returning new Vehicles
 * with predicted latitude/longitude. Pure — identity-stable ids are preserved
 * so the marker pipeline just repositions existing markers.
 *
 * @param {object[]} aircraft
 * @param {number} elapsedSeconds
 * @returns {object[]}
 */
export function predictAircraft(aircraft, elapsedSeconds) {
  if (!Array.isArray(aircraft) || !(elapsedSeconds > 0)) return aircraft;
  return aircraft.map((a) => {
    const [latitude, longitude] = projectPosition(a, elapsedSeconds);
    return latitude === a.latitude && longitude === a.longitude
      ? a
      : { ...a, latitude, longitude };
  });
}
