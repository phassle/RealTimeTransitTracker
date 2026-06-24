import L from 'leaflet';
import { MODE_COLORS, MODE_ICONS } from './modes';
import { escapeHtml } from './markerCollection';

export function vehiclePopupContent(vehicle, { followed = false } = {}) {
  const time = new Date((vehicle.timestamp ?? 0) * 1000).toLocaleTimeString('sv-SE');
  const speedKmh = ((vehicle.speed ?? 0) * 3.6).toFixed(1);
  // Follow control: a single toggle button. Label flips to "Stop following" for
  // the currently-followed Vehicle (issue #167, stories 12 & 15). The click is
  // wired in onMarkerCreated via the [data-vehicle-follow] hook.
  const followLabel = followed ? 'Stop following' : 'Follow';

  return `
    <div style="font-family: sans-serif; min-width: 150px;">
      <strong style="font-size: 14px; text-transform: capitalize;">${escapeHtml(vehicle.mode)} ${escapeHtml(vehicle.line)}</strong><br/>
      ${vehicle.operator ? `<em style="color: #666; font-size: 12px;">${escapeHtml(vehicle.operator.toUpperCase())}</em><br/>` : ''}
      <hr style="margin: 5px 0; border: none; border-top: 1px solid #eee;"/>
      Speed: ${speedKmh} km/h<br/>
      Bearing: ${escapeHtml(vehicle.bearing)}°<br/>
      Updated: ${time}
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
 * @param {{ isHighlighted?: (vehicleId: string) => boolean, isFollowed?: (vehicleId: string) => boolean, onFollowToggle?: (vehicleId: string) => void, getZoom?: () => number }} [opts]
 *   isHighlighted lets the command-center view highlight vehicles involved in a
 *   selected Incident. Default: nothing highlighted (existing map view behaviour).
 *   isFollowed marks the single Followed vehicle (issue #167). Its accent is a
 *   distinct third visual state that COMPOSES with the highlight (both can be on
 *   at once — follow and highlight are orthogonal) rather than replacing it.
 *   onFollowToggle is invoked with the vehicle id when the popup Follow/Stop
 *   control is activated, so App can flip session follow state.
 *   getZoom supplies the current map zoom; below FULL_MARKER_MIN_ZOOM markers
 *   render compact. Default: always full-size.
 */
export function createVehicleAdapter({ isHighlighted = () => false, isFollowed = () => false, onFollowToggle = () => {}, getZoom = () => FULL_MARKER_MIN_ZOOM } = {}) {
  const markerVehicles = new WeakMap();
  const markerVisualStateKeys = new WeakMap();

  function visualStateFor(vehicle) {
    const color = MODE_COLORS[vehicle.mode] || MODE_COLORS.unknown;
    const icon = MODE_ICONS[vehicle.mode] || MODE_ICONS.unknown;
    const highlighted = isHighlighted(vehicle.id);
    const followed = isFollowed(vehicle.id);
    // Followed (like highlighted) stays full-size so its accent is legible even
    // when the surrounding field is clustered/compact.
    const compact = !highlighted && !followed && getZoom() < FULL_MARKER_MIN_ZOOM;
    const label = vehicle.line?.length <= 3 ? ['line', String(vehicle.line ?? '')] : ['icon', icon];

    return {
      color,
      icon,
      highlighted,
      followed,
      compact,
      key: JSON.stringify([compact, color, highlighted, followed, label]),
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
    if (typeof marker.setPopupContent === 'function') marker.setPopupContent(lazyPopupContent(vehicle));
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
    const border = state.highlighted ? '3px solid #ffd400' : '2px solid white';
    // Follow accent: a distinct cyan ring/glow, deliberately unlike the gold
    // highlight. It COMPOSES with the highlight — a followed+highlighted vehicle
    // keeps the gold border and gains the cyan glow, so the two never fight.
    let shadow = state.highlighted
      ? '0 0 0 3px rgba(255,212,0,0.5), 0 2px 4px rgba(0,0,0,0.3)'
      : '0 2px 4px rgba(0,0,0,0.3)';
    if (state.followed) {
      shadow = `0 0 0 4px rgba(0,200,255,0.85), ${shadow}`;
    }
    const classNames = ['vehicle-marker'];
    if (state.highlighted) classNames.push('vehicle-marker--highlighted');
    if (state.followed) classNames.push('vehicle-marker--followed');
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
