import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MODE_COLORS = {
  metro: '#FF6B35',
  bus: '#4ECDC4',
  train: '#95E1D3',
  tram: '#F38181',
  ship: '#AA96DA',
  ferry: '#FCBAD3',
  unknown: '#888888'
};

const MODE_ICONS = {
  metro: 'M',
  bus: 'B',
  train: 'T',
  tram: 'S',
  ship: '⛴',
  ferry: '⛴',
  unknown: '?'
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Use globalThis.Map to avoid collision with React component name
const JSMap = globalThis.Map;

export function Map({ vehicles = [], center = [59.3293, 18.0686], zoom = 11 }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(new JSMap());
  const markerLayerRef = useRef(null);

  // Initialize map
  useEffect(() => {
    if (!mapInstanceRef.current && mapRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        preferCanvas: true // Better performance for many markers
      }).setView(center, zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Data: <a href="https://trafiklab.se">Trafiklab</a>',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);

      // Create layer for markers
      markerLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update vehicle markers
  useEffect(() => {
    if (!markerLayerRef.current) return;

    const layer = markerLayerRef.current;
    const currentVehicleIds = new Set(vehicles.map(v => v.id));
    const existingMarkers = markersRef.current;

    // Remove markers for vehicles that no longer exist
    for (const [vehicleId, marker] of existingMarkers.entries()) {
      if (!currentVehicleIds.has(vehicleId)) {
        layer.removeLayer(marker);
        existingMarkers.delete(vehicleId);
      }
    }

    // Update or create markers
    vehicles.forEach(vehicle => {
      const existingMarker = existingMarkers.get(vehicle.id);
      const color = MODE_COLORS[vehicle.mode] || MODE_COLORS.unknown;
      const icon = MODE_ICONS[vehicle.mode] || MODE_ICONS.unknown;

      if (existingMarker) {
        // Update existing marker
        existingMarker.setLatLng([vehicle.latitude, vehicle.longitude]);
        existingMarker.setPopupContent(createPopupContent(vehicle));
      } else {
        // Create new marker
        const markerIcon = L.divIcon({
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

        const marker = L.marker([vehicle.latitude, vehicle.longitude], {
          icon: markerIcon,
          title: `${escapeHtml(vehicle.mode)} ${escapeHtml(vehicle.line)}`
        })
          .bindPopup(createPopupContent(vehicle), { closeButton: true })
          .addTo(layer);

        existingMarkers.set(vehicle.id, marker);
      }
    });

    markersRef.current = existingMarkers;
  }, [vehicles]);

  return (
    <div
      ref={mapRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative'
      }}
    />
  );
}

function createPopupContent(vehicle) {
  const time = new Date(vehicle.timestamp * 1000).toLocaleTimeString('sv-SE');
  const speedKmh = (vehicle.speed * 3.6).toFixed(1);

  return `
    <div style="font-family: sans-serif; min-width: 150px;">
      <strong style="font-size: 14px; text-transform: capitalize;">${escapeHtml(vehicle.mode)} ${escapeHtml(vehicle.line)}</strong><br/>
      ${vehicle.lineName ? `<em style="color: #666; font-size: 12px;">${escapeHtml(vehicle.lineName)}</em><br/>` : ''}
      <hr style="margin: 5px 0; border: none; border-top: 1px solid #eee;"/>
      Speed: ${speedKmh} km/h<br/>
      Bearing: ${vehicle.bearing}°<br/>
      Updated: ${time}
    </div>
  `;
}
