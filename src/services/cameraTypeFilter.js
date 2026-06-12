// Camera-type filtering — pure functions used by the App + ControlPanel to
// hide/show webcam markers by Camera type (PRD #66 stories 4, 13, 14).
//
// The Camera-type enum is defined in `curatedCameras.js`; this module owns
// the display labels and the count/filter primitives. Splitting it out keeps
// the React components presentational and the filtering logic unit-testable
// (no Leaflet, no jsdom, no React).

import { CAMERA_TYPES } from './curatedCameras';

const LABELS = {
  traffic: 'Traffic',
  weather: 'Weather',
  ski: 'Ski',
  construction: 'Construction',
  wildlife: 'Wildlife',
};

export const CAMERA_TYPE_DEFINITIONS = CAMERA_TYPES.map(id => ({
  id,
  label: LABELS[id],
}));

/**
 * Count cameras by Camera type. The returned object always carries an
 * entry for every type in the enum (zero when none present), so callers
 * can render checkboxes without nullish-coalescing on every read.
 * Cameras with an unknown type are ignored.
 *
 * @param {Array<{type: string}>} cameras
 * @returns {Record<string, number>}
 */
export function cameraCountsByType(cameras) {
  const counts = Object.fromEntries(CAMERA_TYPES.map(t => [t, 0]));
  for (const cam of cameras) {
    if (Object.prototype.hasOwnProperty.call(counts, cam.type)) {
      counts[cam.type] += 1;
    }
  }
  return counts;
}

/**
 * Keep only cameras whose type is in the enabled set AND in the Camera-type
 * enum. Cameras with an unknown type are dropped even if their type string
 * is listed in `enabledTypes` — the enum is the gate.
 *
 * @param {Array<{type: string}>} cameras
 * @param {Iterable<string>} enabledTypes
 * @returns {Array<object>}
 */
export function filterCamerasByType(cameras, enabledTypes) {
  const allowed = new Set(
    Array.from(enabledTypes).filter(t => CAMERA_TYPES.includes(t)),
  );
  return cameras.filter(c => allowed.has(c.type));
}
