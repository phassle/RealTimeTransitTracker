import L from 'leaflet';

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function defaultCreateMarker(latLng, options) {
  return L.marker(latLng, options);
}

/**
 * Create a marker collection that manages Leaflet markers keyed by item id.
 *
 * Accepts a Leaflet layer group for adding/removing markers and an optional
 * createMarker factory for testing without a real map.
 *
 * Adapter interface (passed per update call):
 *   toLatLng(item)  → [lat, lng] | null  (null skips the item)
 *   toIcon(item)    → Leaflet icon
 *   toPopup(item)   → HTML string or Leaflet popup content function
 *   onUpdate?       → (marker, item) called when updating an existing marker
 *                     (default: setLatLng + setPopupContent)
 *   shouldReadd?    → (marker, item) → boolean; when true and the layer is a
 *                     cluster group (has removeLayers/addLayers), the marker is
 *                     bulk-removed, updated, and re-added so clusters re-bucket
 *                     moved markers (markercluster does not track setLatLng)
 */
export function createMarkerCollection(layer, { createMarker = defaultCreateMarker } = {}) {
  const markers = new Map();
  const layerSupportsBulkReadd =
    typeof layer.removeLayers === 'function' && typeof layer.addLayers === 'function';

  function update(items, adapter) {
    const currentIds = new Set();
    items.forEach(item => currentIds.add(item.id));

    for (const [id, marker] of markers.entries()) {
      if (!currentIds.has(id)) {
        layer.removeLayer(marker);
        markers.delete(id);
      }
    }

    function applyUpdate(marker, item, latLng) {
      if (adapter.onUpdate) {
        adapter.onUpdate(marker, item);
      } else {
        marker.setLatLng(latLng);
        marker.setPopupContent(adapter.toPopup(item));
      }
    }

    const readds = [];
    for (const item of items) {
      const latLng = adapter.toLatLng(item);
      if (!latLng) continue;

      const existing = markers.get(item.id);
      if (existing) {
        if (layerSupportsBulkReadd && adapter.shouldReadd && adapter.shouldReadd(existing, item)) {
          readds.push([existing, item, latLng]);
        } else {
          applyUpdate(existing, item, latLng);
        }
      } else {
        const icon = adapter.toIcon(item);
        const extraOpts = adapter.toMarkerOptions ? adapter.toMarkerOptions(item) : {};
        const marker = createMarker(latLng, { icon, ...extraOpts });
        const popupOpts = adapter.toPopupOptions ? adapter.toPopupOptions(item) : { closeButton: true };
        marker.bindPopup(adapter.toPopup(item), popupOpts);
        layer.addLayer(marker);
        markers.set(item.id, marker);
        if (adapter.onMarkerCreated) {
          adapter.onMarkerCreated(marker, item);
        }
      }
    }

    if (readds.length) {
      layer.removeLayers(readds.map(([marker]) => marker));
      for (const [marker, item, latLng] of readds) applyUpdate(marker, item, latLng);
      layer.addLayers(readds.map(([marker]) => marker));
    }
  }

  function clear() {
    for (const marker of markers.values()) {
      layer.removeLayer(marker);
    }
    markers.clear();
  }

  return { update, clear };
}
