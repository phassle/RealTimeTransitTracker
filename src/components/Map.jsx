import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { tileLayerConfig } from './tileLayerConfig';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { createMarkerCollection } from '../services/markerCollection';
import { createVehicleAdapter, FULL_MARKER_MIN_ZOOM } from '../services/vehicleAdapter';
import { createWebcamAdapter } from '../services/webcamAdapter';

export function Map({ vehicles = [], cameras = [], center = [59.3293, 18.0686], zoom = 11, onBoundsChange = null, theme = 'light', highlightedVehicleIds = [] }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const vehicleCollectionRef = useRef(null);
  // Highlight set is read live by the adapter so selection changes are reflected.
  const highlightRef = useRef(new Set());
  highlightRef.current = new Set(highlightedVehicleIds);
  // Current zoom, read live by the adapter; mapZoom state re-triggers the
  // marker-update effect so existing markers swap compact/full icons on zoom.
  const zoomRef = useRef(zoom);
  const [mapZoom, setMapZoom] = useState(zoom);
  const vehicleAdapterRef = useRef(
    createVehicleAdapter({
      isHighlighted: (id) => highlightRef.current.has(id),
      getZoom: () => zoomRef.current,
    }),
  );
  const webcamCollectionRef = useRef(null);
  const webcamAdapterRef = useRef(createWebcamAdapter());
  const markerLayerRef = useRef(null);
  const tileLayerRef = useRef(null);
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
        preferCanvas: true, // Better performance for many markers
        zoomControl: false, // Default top-left sits under the control panel
      }).setView(center, zoom);
      L.control.zoom({ position: 'topright' }).addTo(map);

      mapInstanceRef.current = map;

      const { url, attribution } = tileLayerConfig(theme);
      tileLayerRef.current = L.tileLayer(url, { attribution, maxZoom: 19 }).addTo(map);

      // Clustered layer for vehicle markers: count bubbles when zoomed out,
      // individual markers from FULL_MARKER_MIN_ZOOM and in. Animations off —
      // 2000+ markers are re-fed every poll.
      markerLayerRef.current = L.markerClusterGroup({
        disableClusteringAtZoom: FULL_MARKER_MIN_ZOOM,
        maxClusterRadius: 50,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: false,
        chunkedLoading: true,
        animate: false,
        animateAddingMarkers: false,
      }).addTo(map);
      vehicleCollectionRef.current = createMarkerCollection(markerLayerRef.current);

      // Clustered layer for webcam markers — second adapter on the marker-collection module.
      cameraClusterRef.current = L.markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        chunkedLoading: true,
      }).addTo(map);
      webcamCollectionRef.current = createMarkerCollection(cameraClusterRef.current);

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
      map.on('zoomend', () => {
        zoomRef.current = map.getZoom();
        setMapZoom(map.getZoom());
      });
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

  // Update vehicle markers via the marker-collection module. Re-runs when the
  // highlight set or zoom changes too, so existing markers refresh their icon.
  const highlightKey = highlightedVehicleIds.join(',');
  useEffect(() => {
    vehicleCollectionRef.current?.update(vehicles, vehicleAdapterRef.current);
  }, [vehicles, highlightKey, mapZoom]);

  // Update webcam markers via the marker-collection module (webcam adapter).
  useEffect(() => {
    webcamCollectionRef.current?.update(cameras, webcamAdapterRef.current);
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



