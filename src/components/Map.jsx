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

const EMPTY_VEHICLE_IDS = [];
const EMPTY_FOLLOWED_VEHICLE_IDS = [];
const NOOP = () => {};

function haveSameOrderedIds(previousIds, nextIds) {
  if (previousIds.length !== nextIds.length) return false;
  for (let i = 0; i < previousIds.length; i += 1) {
    if (previousIds[i] !== nextIds[i]) return false;
  }
  return true;
}

function createIdSetState(ids) {
  return {
    ids: ids.slice(),
    idSet: new Set(ids),
  };
}

function createHighlightState(highlightedVehicleIds) {
  return {
    ...createIdSetState(highlightedVehicleIds),
    vehicles: null,
    mapZoom: null,
  };
}

// Refresh a keyed id-set state in place when the ordered ids changed; returns
// whether it changed so the caller can gate marker churn.
function updateIdSet(state, nextIds) {
  if (haveSameOrderedIds(state.ids, nextIds)) return false;
  state.ids = nextIds.slice();
  state.idSet = new Set(nextIds);
  return true;
}

export function Map({ vehicles = [], cameras = [], center = [59.3293, 18.0686], zoom = 11, onBoundsChange = null, theme = 'light', highlightedVehicleIds = EMPTY_VEHICLE_IDS, predictedVehicleIds = EMPTY_VEHICLE_IDS, userLocation = null, followedVehicleIds = EMPTY_FOLLOWED_VEHICLE_IDS, onFollowToggle = NOOP, followPosition = null, onMapClick = NOOP }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  // Singleton User location marker (PRD #111). A single circle marker managed
  // directly here — deliberately NOT routed through the keyed marker-collection,
  // which exists for id-diffed collections. Re-locating moves this one marker.
  const userMarkerRef = useRef(null);
  const vehicleCollectionRef = useRef(null);
  // Highlight set is read live by the adapter so selection changes are reflected.
  const [initialHighlightState] = useState(() => createHighlightState(highlightedVehicleIds));
  const highlightStateRef = useRef(initialHighlightState);
  // Predicted (Downstream) set: a selected Incident projection's forecast (PRD
  // #136). Read live by the adapter, parallel to the highlight set, so a
  // forecast accent never reads as the observed selection. Empty in the plain
  // map view and whenever the projection is null/retracted.
  const [initialPredictedState] = useState(() => createIdSetState(predictedVehicleIds));
  const predictedStateRef = useRef(initialPredictedState);
  // Follow set (the single Followed vehicle, issue #167), read live by the
  // adapter parallel to the highlight set. Follow composes with highlight, so
  // it is a separate set rather than sharing the highlight one.
  const [initialFollowState] = useState(() => createIdSetState(followedVehicleIds));
  const followStateRef = useRef(initialFollowState);
  // onFollowToggle is read live by the adapter via this ref so a popup Follow
  // click always reaches the current handler without rebuilding the adapter.
  const onFollowToggleRef = useRef(onFollowToggle);
  onFollowToggleRef.current = onFollowToggle;
  // Current zoom, read live by the adapter; mapZoom state re-triggers the
  // marker-update effect so existing markers swap compact/full icons on zoom.
  const zoomRef = useRef(zoom);
  const [mapZoom, setMapZoom] = useState(zoom);
  const vehicleAdapterRef = useRef(
    createVehicleAdapter({
      isHighlighted: (id) => highlightStateRef.current.idSet.has(id),
      isPredicted: (id) => predictedStateRef.current.idSet.has(id),
      isFollowed: (id) => followStateRef.current.idSet.has(id),
      onFollowToggle: (id) => onFollowToggleRef.current(id),
      getZoom: () => zoomRef.current,
    }),
  );
  // onMapClick (stop-following on empty-map click) read live so the handler
  // bound once on the map always calls the current prop.
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
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

      // Clicking the empty map background (not a marker) stops following
      // (issue #167, story 16). Leaflet's map 'click' only fires for the base
      // map, not for marker clicks, so this never fires when opening a popup.
      map.on('click', () => onMapClickRef.current());

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

  // Follow pan (issue #167): while following, pan to the followed Vehicle's
  // latest position on every update — a smooth panTo that KEEPS the user's
  // current zoom, deliberately not the 1s re-zooming flyTo used for jumps.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !followPosition) return;
    map.panTo(followPosition);
  }, [followPosition]);

  // Update vehicle markers via the marker-collection module. Runs after render
  // so highlight/predicted bookkeeping stays out of render; the equality gate
  // prevents marker churn unless vehicles, ordered highlights, the predicted
  // (Downstream) set, or zoom actually changed.
  useEffect(() => {
    const highlightState = highlightStateRef.current;
    const highlightsChanged = updateIdSet(highlightState, highlightedVehicleIds);
    const predictedChanged = updateIdSet(predictedStateRef.current, predictedVehicleIds);
    const followChanged = updateIdSet(followStateRef.current, followedVehicleIds);

    const vehiclesChanged = highlightState.vehicles !== vehicles;
    const zoomChanged = highlightState.mapZoom !== mapZoom;
    if (!vehiclesChanged && !highlightsChanged && !predictedChanged && !followChanged && !zoomChanged) return;

    highlightState.vehicles = vehicles;
    highlightState.mapZoom = mapZoom;
    vehicleCollectionRef.current?.update(vehicles, vehicleAdapterRef.current);
  });

  // Update webcam markers via the marker-collection module (webcam adapter).
  useEffect(() => {
    webcamCollectionRef.current?.update(cameras, webcamAdapterRef.current);
  }, [cameras]);

  // User location singleton: place once, then move on subsequent fixes. Styled
  // as a distinct "you are here" blue accent — never a transport-mode colour —
  // so it is never mistaken for a Vehicle. The accent is theme-aware (issue
  // #115, story 15): a deeper blue on light tiles, a brighter blue on dark tiles
  // (matching the locate button), so it stays legible against either basemap
  // while keeping its distinct white-ringed accent. Restyled on theme change.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !userLocation) return;
    const latlng = [userLocation.latitude, userLocation.longitude];
    const style = {
      radius: 8,
      color: '#ffffff',
      weight: 2,
      fillColor: theme === 'dark' ? '#5b9dff' : '#1d6fe0',
      fillOpacity: 1,
    };
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(latlng);
      userMarkerRef.current.setStyle(style);
    } else {
      userMarkerRef.current = L.circleMarker(latlng, style).addTo(map);
      userMarkerRef.current.bindTooltip('You are here');
    }
  }, [userLocation, theme]);

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
