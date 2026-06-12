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
 *   toPopup(item)   → HTML string
 *   onUpdate?       → (marker, item) called when updating an existing marker
 *                     (default: setLatLng + setPopupContent)
 */
export function createMarkerCollection(layer, { createMarker = defaultCreateMarker } = {}) {
  const markers = new Map();

  function update(items, adapter) {
    const currentIds = new Set(items.map(item => item.id));

    for (const [id, marker] of markers.entries()) {
      if (!currentIds.has(id)) {
        layer.removeLayer(marker);
        markers.delete(id);
      }
    }

    for (const item of items) {
      const latLng = adapter.toLatLng(item);
      if (!latLng) continue;

      const existing = markers.get(item.id);
      if (existing) {
        if (adapter.onUpdate) {
          adapter.onUpdate(existing, item);
        } else {
          existing.setLatLng(latLng);
          existing.setPopupContent(adapter.toPopup(item));
        }
      } else {
        const icon = adapter.toIcon(item);
        const marker = createMarker(latLng, { icon });
        marker.bindPopup(adapter.toPopup(item), { closeButton: true });
        layer.addLayer(marker);
        markers.set(item.id, marker);
      }
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
