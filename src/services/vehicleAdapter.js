import L from 'leaflet';
import { MODE_COLORS, MODE_ICONS } from './modes';
import { escapeHtml } from './markerCollection';

export function vehiclePopupContent(vehicle) {
  const time = new Date((vehicle.timestamp ?? 0) * 1000).toLocaleTimeString('sv-SE');
  const speedKmh = ((vehicle.speed ?? 0) * 3.6).toFixed(1);

  return `
    <div style="font-family: sans-serif; min-width: 150px;">
      <strong style="font-size: 14px; text-transform: capitalize;">${escapeHtml(vehicle.mode)} ${escapeHtml(vehicle.line)}</strong><br/>
      ${vehicle.operator ? `<em style="color: #666; font-size: 12px;">${escapeHtml(vehicle.operator.toUpperCase())}</em><br/>` : ''}
      <hr style="margin: 5px 0; border: none; border-top: 1px solid #eee;"/>
      Speed: ${speedKmh} km/h<br/>
      Bearing: ${escapeHtml(vehicle.bearing)}°<br/>
      Updated: ${time}
    </div>
  `;
}

// Below this zoom, vehicles render as small dots (no line label) so dense
// regions stay readable. Highlighted vehicles always render full-size.
export const FULL_MARKER_MIN_ZOOM = 12;

/**
 * @param {{ isHighlighted?: (vehicleId: string) => boolean, getZoom?: () => number }} [opts]
 *   isHighlighted lets the command-center view highlight vehicles involved in a
 *   selected Incident. Default: nothing highlighted (existing map view behaviour).
 *   getZoom supplies the current map zoom; below FULL_MARKER_MIN_ZOOM markers
 *   render compact. Default: always full-size.
 */
export function createVehicleAdapter({ isHighlighted = () => false, getZoom = () => FULL_MARKER_MIN_ZOOM } = {}) {
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

  function buildIcon(vehicle) {
    const color = MODE_COLORS[vehicle.mode] || MODE_COLORS.unknown;
    const icon = MODE_ICONS[vehicle.mode] || MODE_ICONS.unknown;
    const highlighted = isHighlighted(vehicle.id);
    if (!highlighted && getZoom() < FULL_MARKER_MIN_ZOOM) {
      return buildCompactIcon(color);
    }
    const border = highlighted ? '3px solid #ffd400' : '2px solid white';
    const shadow = highlighted
      ? '0 0 0 3px rgba(255,212,0,0.5), 0 2px 4px rgba(0,0,0,0.3)'
      : '0 2px 4px rgba(0,0,0,0.3)';
    return L.divIcon({
      className: highlighted ? 'vehicle-marker vehicle-marker--highlighted' : 'vehicle-marker',
      html: `
          <div style="
            background: ${color};
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
            ${vehicle.line?.length <= 3 ? escapeHtml(vehicle.line) : icon}
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
      return vehiclePopupContent(vehicle);
    },

    onUpdate(marker, vehicle) {
      marker.setLatLng([vehicle.latitude, vehicle.longitude]);
      marker.setPopupContent(vehiclePopupContent(vehicle));
      // Refresh the icon so highlight state tracks the selected Incident.
      // Guarded: test fakes may not implement setIcon.
      if (typeof marker.setIcon === 'function') marker.setIcon(buildIcon(vehicle));
    },
  };
}
