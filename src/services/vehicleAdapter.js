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

export function createVehicleAdapter() {
  return {
    toLatLng(vehicle) {
      if (!vehicle.latitude || !vehicle.longitude) return null;
      return [vehicle.latitude, vehicle.longitude];
    },

    toIcon(vehicle) {
      const color = MODE_COLORS[vehicle.mode] || MODE_COLORS.unknown;
      const icon = MODE_ICONS[vehicle.mode] || MODE_ICONS.unknown;
      return L.divIcon({
        className: 'vehicle-marker',
        html: `
          <div style="
            background: ${color};
            border: 2px solid white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: bold;
            color: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            cursor: pointer;
          ">
            ${vehicle.line?.length <= 3 ? escapeHtml(vehicle.line) : icon}
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
    },

    toPopup(vehicle) {
      return vehiclePopupContent(vehicle);
    },

    onUpdate(marker, vehicle) {
      marker.setLatLng([vehicle.latitude, vehicle.longitude]);
      marker.setPopupContent(vehiclePopupContent(vehicle));
    },
  };
}
