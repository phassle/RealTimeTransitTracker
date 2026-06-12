import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { tileLayerConfig } from './tileLayerConfig';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import {
  cameraPopupImageContent,
  cameraPopupErrorContent,
  cameraPopupLinkoutContent,
  cacheBustImageUrl,
} from '../services/webcamPopup';
import { CAMERA_TYPE_DEFINITIONS } from '../services/cameraTypeFilter';
import { escapeHtml, createMarkerCollection } from '../services/markerCollection';
import { createVehicleAdapter } from '../services/vehicleAdapter';

const CAMERA_TYPE_COLOR = Object.fromEntries(
  CAMERA_TYPE_DEFINITIONS.map(t => [t.id, t.color])
);
const CAMERA_DEFAULT_COLOR = '#2c3e50';

// Use globalThis.Map to avoid collision with React component name
const JSMap = globalThis.Map;

export function Map({ vehicles = [], cameras = [], center = [59.3293, 18.0686], zoom = 11, onBoundsChange = null, theme = 'light' }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const vehicleCollectionRef = useRef(null);
  const vehicleAdapterRef = useRef(createVehicleAdapter());
  const markerLayerRef = useRef(null);
  const tileLayerRef = useRef(null);
  const cameraMarkersRef = useRef(new JSMap());
  const cameraClusterRef = useRef(null);
  const boundsTimerRef = useRef(null);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const initialRenderRef = useRef(true);

  // Keep callback ref up to date
  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
  }, [onBoundsChange]);

  // Initialize map
  useEffect(() => {
    if (!mapInstanceRef.current && mapRef.current) {
      const map = L.map(mapRef.current, {
        preferCanvas: true // Better performance for many markers
      }).setView(center, zoom);

      mapInstanceRef.current = map;

      const { url, attribution } = tileLayerConfig(theme);
      tileLayerRef.current = L.tileLayer(url, { attribution, maxZoom: 19 }).addTo(map);

      // Create layer for vehicle markers
      markerLayerRef.current = L.layerGroup().addTo(map);
      vehicleCollectionRef.current = createMarkerCollection(markerLayerRef.current);

      // Clustered layer dedicated to webcams — leaves the vehicle marker
      // lifecycle above completely untouched.
      cameraClusterRef.current = L.markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        chunkedLoading: true,
      }).addTo(map);

      // Viewport bounds reporting (debounced 300ms)
      const reportBounds = () => {
        clearTimeout(boundsTimerRef.current);
        boundsTimerRef.current = setTimeout(() => {
          const b = map.getBounds();
          if (onBoundsChangeRef.current) {
            onBoundsChangeRef.current({
              south: b.getSouth(), west: b.getWest(),
              north: b.getNorth(), east: b.getEast(),
            });
          }
        }, 300);
      };

      map.on('moveend', reportBounds);
      map.on('zoomend', reportBounds);
      reportBounds(); // initial bounds
    }

    return () => {
      clearTimeout(boundsTimerRef.current);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Swap tile layer when theme changes
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const { url, attribution } = tileLayerConfig(theme);
    tileLayerRef.current.remove();
    tileLayerRef.current = L.tileLayer(url, { attribution, maxZoom: 19 }).addTo(mapInstanceRef.current);
  }, [theme]);

  // Fly to new center/zoom when props change (skip first render)
  useEffect(() => {
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      return;
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(center, zoom, { duration: 1 });
    }
  }, [center, zoom]);

  // Update vehicle markers via the marker-collection module
  useEffect(() => {
    vehicleCollectionRef.current?.update(vehicles, vehicleAdapterRef.current);
  }, [vehicles]);

  // Update camera markers (webcam layer — clustered, no popup in this slice).
  useEffect(() => {
    const cluster = cameraClusterRef.current;
    if (!cluster) return;

    const existing = cameraMarkersRef.current;
    const currentIds = new Set(cameras.map(c => c.id));

    for (const [id, marker] of existing.entries()) {
      if (!currentIds.has(id)) {
        cluster.removeLayer(marker);
        existing.delete(id);
      }
    }

    const toAdd = [];
    cameras.forEach(cam => {
      if (existing.has(cam.id)) return;
      const markerColor = CAMERA_TYPE_COLOR[cam.type] || CAMERA_DEFAULT_COLOR;
      const icon = L.divIcon({
        className: 'camera-marker',
        html: `
          <div style="
            background: ${markerColor};
            border: 2px solid white;
            border-radius: 4px;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            color: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            cursor: pointer;
          ">📷</div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      const marker = L.marker([cam.lat, cam.lon], {
        icon,
        title: `${escapeHtml(cam.name)} (${escapeHtml(cam.attribution)})`,
      });
      const isLinkout = cam.media === 'linkout';
      marker.bindPopup(
        () => (isLinkout ? cameraPopupLinkoutContent(cam) : cameraPopupImageContent(cam)),
        { closeButton: true, minWidth: 240, maxWidth: 320 },
      );
      // Linkout cameras have nothing to wire — no img, no refresh button.
      if (!isLinkout) {
        marker.on('popupopen', (event) => wireCameraPopup(event.popup, cam));
      }
      existing.set(cam.id, marker);
      toAdd.push(marker);
    });
    if (toAdd.length > 0) {
      cluster.addLayers(toAdd);
    }
  }, [cameras]);

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

// Wire interactive bits of the camera popup after Leaflet has inserted it
// into the DOM:
//   * <img onerror>  → swap to error placeholder (image source down)
//   * refresh button → re-render popup with a cache-busted image URL so the
//                      browser doesn't serve the same cached still
function wireCameraPopup(popup, camera) {
  const root = popup.getElement();
  if (!root) return;
  const img = root.querySelector('[data-webcam-image]');
  const btn = root.querySelector('[data-webcam-refresh]');

  if (img) {
    img.addEventListener('error', () => {
      popup.setContent(cameraPopupErrorContent(camera));
    }, { once: true });
  }

  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const fresh = cacheBustImageUrl(camera.imageUrl, Date.now());
      popup.setContent(cameraPopupImageContent(camera, { imageUrl: fresh }));
      // setContent replaces DOM nodes — re-bind listeners on the new ones.
      wireCameraPopup(popup, camera);
    });
  }
}

