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
  const markerPopupKeys = new WeakMap();

  // Everything the popup actually displays. A predicted-position tick (idea #51)
  // moves the marker every ~1s but changes none of this, so we can skip the
  // popup rebuild and keep the live Follow button (and its listener) intact.
  function popupSignature(vehicle, followed) {
    return JSON.stringify([
      vehicle.mode, vehicle.line, vehicle.operator, vehicle.type, vehicle.reg,
      vehicle.altitude, vehicle.speed, vehicle.bearing, vehicle.timestamp, followed,
    ]);
  }

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

    return {
      color,
      icon,
      highlighted,
      predicted,
      followed,
      compact,
      // The marker renders the type pictogram (state.icon), so the icon — not the
      // line number — is what visibly changes; keying on it avoids a needless
      // setIcon when only a vehicle's line label changes.
      key: JSON.stringify([compact, color, highlighted, predicted, followed, icon]),
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
    // Only rebuild when the DISPLAYED content changes. Skipping a no-op rebuild
    // (e.g. a predicted-position tick) keeps the live Follow button — rebuilding
    // every ~1s would destroy/recreate it faster than it can be clicked.
    const signature = popupSignature(vehicle, isFollowed(vehicle.id));
    if (markerPopupKeys.get(marker) === signature) return;
    markerPopupKeys.set(marker, signature);
    marker.setPopupContent(lazyPopupContent(vehicle));
    // setPopupContent replaces the popup DOM, discarding the Follow listener
    // wired on popupopen — re-wire it against the fresh content.
    if (typeof marker.getPopup === 'function') {
      wireFollowControl(marker.getPopup(), markerVehicles.get(marker) ?? vehicle);
    }
  }

  function buildCompactIcon(icon) {
    // Low-zoom marker: the type pictogram (a plane reads as a plane even when
    // zoomed right out), with a dark halo so it stays legible on dark tiles.
    return L.divIcon({
      className: 'vehicle-marker vehicle-marker--compact',
      html: `
          <div style="
            font-size: 14px;
            line-height: 14px;
            text-align: center;
            text-shadow: 0 0 2px #000, 0 0 3px #000;
            cursor: pointer;
          ">${icon}</div>
        `,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
  }

  function buildIcon(vehicle, state = visualStateFor(vehicle)) {
    if (state.compact) {
      return buildCompactIcon(state.icon);
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
            font-size: 13px;
            line-height: 1;
            color: white;
            box-shadow: ${shadow};
            cursor: pointer;
          ">
            ${state.icon}
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
        marker.on('popupopen', (event) => {
          const v = markerVehicles.get(marker) ?? vehicle;
          wireFollowControl(event.popup, v);
          // Seed the popup signature so the prediction ticks that follow don't
          // needlessly rebuild the popup and break the just-wired Follow button.
          markerPopupKeys.set(marker, popupSignature(v, isFollowed(v.id)));
        });
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
      // Never re-add a marker whose popup is open — re-adding it to the cluster
      // layer closes the popup, which under 1s dead-reckoning ticks would make
      // the Follow control un-clickable at low zoom. It still moves via setLatLng.
      if (typeof marker.isPopupOpen === 'function' && marker.isPopupOpen()) return false;
      if (typeof marker.getLatLng !== 'function') return false;
      const current = marker.getLatLng();
      return current.lat !== vehicle.latitude || current.lng !== vehicle.longitude;
    },
  };
}
