import L from 'leaflet';
import { MODE_COLORS, MODE_ICONS } from './modes';
import { escapeHtml } from './markerCollection';

export function vehiclePopupContent(vehicle, { followed = false } = {}) {
  const speedKmh = ((vehicle.speed ?? 0) * 3.6).toFixed(1);
  // "Updated" only for Vehicles that carry a feed timestamp (transit). Aircraft
  // have none, so the line is omitted rather than showing the 1970 epoch.
  const updatedLine = vehicle.timestamp != null
    ? `Updated: ${new Date(vehicle.timestamp * 1000).toLocaleTimeString('sv-SE')}`
    : '';
  // Follow control: a single toggle button. Label flips to "Stop following" for
  // the currently-followed Vehicle (issue #167, stories 12 & 15). The click is
  // wired in onMarkerCreated via the [data-vehicle-follow] hook.
  const followLabel = followed ? 'Stop following' : 'Follow';

  // Aircraft extras (type / registration / altitude) — present only on
  // aircraft Vehicles; absent for transit Vehicles, so the lines are omitted.
  const typeLine = vehicle.type ? `Type: ${escapeHtml(vehicle.type)}<br/>` : '';
  const regLine = vehicle.reg ? `Reg: ${escapeHtml(vehicle.reg)}<br/>` : '';
  const altitudeLine = vehicle.altitude != null
    ? `Altitude: ${escapeHtml(vehicle.altitude)} ft<br/>`
    : '';

  return `
    <div style="font-family: sans-serif; min-width: 150px;">
      <strong style="font-size: 14px; text-transform: capitalize;">${escapeHtml(vehicle.mode)} ${escapeHtml(vehicle.line)}</strong><br/>
      ${vehicle.operator ? `<em style="color: #666; font-size: 12px;">${escapeHtml(vehicle.operator.toUpperCase())}</em><br/>` : ''}
      <hr style="margin: 5px 0; border: none; border-top: 1px solid #eee;"/>
      ${typeLine}${regLine}${altitudeLine}Speed: ${speedKmh} km/h<br/>
      Bearing: ${escapeHtml(vehicle.bearing)}°${updatedLine ? `<br/>\n      ${updatedLine}` : ''}
      <hr style="margin: 5px 0; border: none; border-top: 1px solid #eee;"/>
      <button type="button" data-vehicle-follow style="
        width: 100%; padding: 4px 8px; cursor: pointer;
        border: 1px solid #ccc; border-radius: 4px; background: #f5f5f5;
      ">${followLabel}</button>
    </div>
  `;
}

// Below this zoom, vehicles render as small dots (no line label) so dense
// regions stay readable. Highlighted vehicles always render full-size.
export const FULL_MARKER_MIN_ZOOM = 12;

/**
 * @param {{ isHighlighted?: (vehicleId: string) => boolean, isPredicted?: (vehicleId: string) => boolean, isFollowed?: (vehicleId: string) => boolean, onFollowToggle?: (vehicleId: string) => void, getZoom?: () => number }} [opts]
 *   isHighlighted lets the command-center view highlight vehicles involved in a
 *   selected Incident. Default: nothing highlighted (existing map view behaviour).
 *   isPredicted accents Downstream vehicles a selected Incident's projection
 *   forecasts will degrade (PRD #136). Styled distinctly from the highlight — a
 *   dashed violet ring vs the solid gold selection — so a forward-looking
 *   Projection never reads as an observed selection on the ground. The highlight
 *   (observation) wins when a vehicle is both. Default: nothing predicted
 *   (existing map view behaviour).
 *   isFollowed marks the single Followed vehicle (issue #167). Its accent is a
 *   distinct third visual state that COMPOSES with the highlight (both can be on
 *   at once — follow and highlight are orthogonal) rather than replacing it.
 *   onFollowToggle is invoked with the vehicle id when the popup Follow/Stop
 *   control is activated, so App can flip session follow state.
 *   getZoom supplies the current map zoom; below FULL_MARKER_MIN_ZOOM markers
 *   render compact. Default: always full-size.
 */
export function createVehicleAdapter({ isHighlighted = () => false, isPredicted = () => false, isFollowed = () => false, onFollowToggle = () => {}, getZoom = () => FULL_MARKER_MIN_ZOOM } = {}) {
  const markerVehicles = new WeakMap();
  const markerVisualStateKeys = new WeakMap();

  function visualStateFor(vehicle) {
    const color = MODE_COLORS[vehicle.mode] || MODE_COLORS.unknown;
    const icon = MODE_ICONS[vehicle.mode] || MODE_ICONS.unknown;
    const highlighted = isHighlighted(vehicle.id);
    // The selection/highlight (an observation) always wins over a prediction so
    // a Downstream-vehicle accent never overrides the observed selection.
    const predicted = !highlighted && isPredicted(vehicle.id);
    // Follow composes with highlight (orthogonal), so it is independent of both.
    const followed = isFollowed(vehicle.id);
    // Highlighted, predicted, and followed vehicles all stay full-size so the
    // accent is legible even when the surrounding field is clustered/compact.
    const compact = !highlighted && !predicted && !followed && getZoom() < FULL_MARKER_MIN_ZOOM;
    const label = vehicle.line?.length <= 3 ? ['line', String(vehicle.line ?? '')] : ['icon', icon];

    return {
      color,
      icon,
      highlighted,
      predicted,
      followed,
      compact,
      key: JSON.stringify([compact, color, highlighted, predicted, followed, label]),
    };
  }

  function lazyPopupContent(vehicle) {
    return (source) => {
      const v = markerVehicles.get(source) ?? vehicle;
      return vehiclePopupContent(v, { followed: isFollowed(v.id) });
    };
  }

  // Wire the Follow/Stop control once the popup is in the DOM. The control
  // toggles follow for this Vehicle via onFollowToggle.
  function wireFollowControl(popup, vehicle) {
    const root = typeof popup.getElement === 'function' ? popup.getElement() : null;
    if (!root) return;
    const btn = root.querySelector('[data-vehicle-follow]');
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      onFollowToggle(vehicle.id);
    });
  }

  function updateOpenPopup(marker, vehicle) {
    if (typeof marker.isPopupOpen !== 'function' || !marker.isPopupOpen()) return;
    if (typeof marker.setPopupContent !== 'function') return;
    marker.setPopupContent(lazyPopupContent(vehicle));
    // setPopupContent replaces the popup DOM, discarding the Follow listener
    // wired on popupopen — re-wire it against the fresh content so the control
    // keeps working across poll updates (otherwise it goes inert after ~2 s).
    if (typeof marker.getPopup === 'function') {
      wireFollowControl(marker.getPopup(), markerVehicles.get(marker) ?? vehicle);
    }
  }

  function buildCompactIcon(color) {
    return L.divIcon({
      className: 'vehicle-marker vehicle-marker--compact',
      html: `
          <div style="
            background: ${color};
            border: 1px solid white;
            border-radius: 50%;
            width: 8px;
            height: 8px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.3);
            cursor: pointer;
          "></div>
        `,
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    });
  }

  function buildIcon(vehicle, state = visualStateFor(vehicle)) {
    if (state.compact) {
      return buildCompactIcon(state.color);
    }
    // Base border/shadow from the observed-selection vs forecast states, which
    // are mutually exclusive (predicted only when not highlighted). Follow then
    // COMPOSES on top of either — it adds a cyan glow and class without
    // replacing the highlight/predicted accent, so the states never fight.
    let border = '2px solid white';
    let shadow = '0 2px 4px rgba(0,0,0,0.3)';
    const classNames = ['vehicle-marker'];
    if (state.highlighted) {
      // Observed selection: solid gold ring.
      border = '3px solid #ffd400';
      shadow = '0 0 0 3px rgba(255,212,0,0.5), 0 2px 4px rgba(0,0,0,0.3)';
      classNames.push('vehicle-marker--highlighted');
    } else if (state.predicted) {
      // Forecast (Projection): dashed violet ring — deliberately unlike the
      // gold selection so a prediction never reads as an observation.
      border = '2px dashed #8a6dff';
      shadow = '0 0 0 3px rgba(138,109,255,0.35), 0 2px 4px rgba(0,0,0,0.3)';
      classNames.push('vehicle-marker--predicted');
    }
    // Follow accent: a distinct cyan glow layered on top of the base shadow.
    if (state.followed) {
      shadow = `0 0 0 4px rgba(0,200,255,0.85), ${shadow}`;
      classNames.push('vehicle-marker--followed');
    }
    return L.divIcon({
      className: classNames.join(' '),
      html: `
          <div style="
            background: ${state.color};
            border: ${border};
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: bold;
            color: white;
            box-shadow: ${shadow};
            cursor: pointer;
          ">
            ${vehicle.line?.length <= 3 ? escapeHtml(vehicle.line) : state.icon}
          </div>
        `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }

  return {
    toLatLng(vehicle) {
      if (!vehicle.latitude || !vehicle.longitude) return null;
      return [vehicle.latitude, vehicle.longitude];
    },

    toIcon(vehicle) {
      return buildIcon(vehicle);
    },

    toPopup(vehicle) {
      return lazyPopupContent(vehicle);
    },

    onMarkerCreated(marker, vehicle) {
      markerVehicles.set(marker, vehicle);
      markerVisualStateKeys.set(marker, visualStateFor(vehicle).key);
      if (typeof marker.on === 'function') {
        marker.on('popupopen', (event) =>
          wireFollowControl(event.popup, markerVehicles.get(marker) ?? vehicle),
        );
      }
    },

    onUpdate(marker, vehicle) {
      markerVehicles.set(marker, vehicle);
      marker.setLatLng([vehicle.latitude, vehicle.longitude]);
      updateOpenPopup(marker, vehicle);

      const visualState = visualStateFor(vehicle);
      if (markerVisualStateKeys.get(marker) === visualState.key) return;

      markerVisualStateKeys.set(marker, visualState.key);
      if (typeof marker.setIcon === 'function') marker.setIcon(buildIcon(vehicle, visualState));
    },

    // Moved markers must be re-added for clusters to re-bucket them. Only while
    // clustering is active (below FULL_MARKER_MIN_ZOOM) — at higher zooms plain
    // setLatLng keeps open popups alive.
    shouldReadd(marker, vehicle) {
      if (getZoom() >= FULL_MARKER_MIN_ZOOM) return false;
      if (typeof marker.getLatLng !== 'function') return false;
      const current = marker.getLatLng();
      return current.lat !== vehicle.latitude || current.lng !== vehicle.longitude;
    },
  };
}
