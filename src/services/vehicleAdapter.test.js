import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';
import { createVehicleAdapter, FULL_MARKER_MIN_ZOOM } from './vehicleAdapter';

// Leaflet mock — only the primitives used by vehicleAdapter
vi.mock('leaflet', () => ({
  default: {
    divIcon: (opts) => ({ _type: 'divIcon', ...opts }),
  },
}));

function makeVehicle(overrides = {}) {
  return {
    id: 'v1',
    mode: 'bus',
    line: '17',
    lineName: 'Citylinjen',
    operator: 'SL',
    latitude: 59.33,
    longitude: 18.07,
    bearing: 45,
    speed: 10,
    timestamp: 1700000000,
    ...overrides,
  };
}

describe('createVehicleAdapter zoom-adaptive icons', () => {
  it('renders the full marker with line label at or above FULL_MARKER_MIN_ZOOM', () => {
    const adapter = createVehicleAdapter({ getZoom: () => FULL_MARKER_MIN_ZOOM });
    const icon = adapter.toIcon(makeVehicle());
    expect(icon.html).toContain('17');
    expect(icon.iconSize).toEqual([24, 24]);
    expect(icon.className).not.toContain('vehicle-marker--compact');
  });

  it('renders a compact dot without line label below FULL_MARKER_MIN_ZOOM', () => {
    const adapter = createVehicleAdapter({ getZoom: () => FULL_MARKER_MIN_ZOOM - 1 });
    const icon = adapter.toIcon(makeVehicle());
    expect(icon.html).not.toContain('17');
    expect(icon.iconSize).toEqual([10, 10]);
    expect(icon.className).toContain('vehicle-marker--compact');
  });

  it('keeps highlighted vehicles full-size even below the zoom threshold', () => {
    const adapter = createVehicleAdapter({
      getZoom: () => FULL_MARKER_MIN_ZOOM - 3,
      isHighlighted: (id) => id === 'v1',
    });
    const icon = adapter.toIcon(makeVehicle());
    expect(icon.iconSize).toEqual([24, 24]);
    expect(icon.className).toContain('vehicle-marker--highlighted');
  });

  it('defaults to full-size markers when no getZoom is provided', () => {
    const adapter = createVehicleAdapter();
    const icon = adapter.toIcon(makeVehicle());
    expect(icon.iconSize).toEqual([24, 24]);
  });

  it('requests re-add for moved vehicles only while clustering is active', () => {
    let zoom = FULL_MARKER_MIN_ZOOM - 2;
    const adapter = createVehicleAdapter({ getZoom: () => zoom });
    const movedMarker = { getLatLng: () => ({ lat: 59.0, lng: 18.0 }) };
    const stillMarker = { getLatLng: () => ({ lat: 59.33, lng: 18.07 }) };

    expect(adapter.shouldReadd(movedMarker, makeVehicle())).toBe(true);
    expect(adapter.shouldReadd(stillMarker, makeVehicle())).toBe(false);

    zoom = FULL_MARKER_MIN_ZOOM; // clustering disabled — keep popups alive
    expect(adapter.shouldReadd(movedMarker, makeVehicle())).toBe(false);
  });

  it('onUpdate swaps an existing marker icon when zoom crosses the threshold', () => {
    let zoom = FULL_MARKER_MIN_ZOOM;
    const adapter = createVehicleAdapter({ getZoom: () => zoom });
    const marker = {
      icon: null,
      setLatLng() { return this; },
      setPopupContent() { return this; },
      setIcon(i) { this.icon = i; return this; },
    };
    zoom = FULL_MARKER_MIN_ZOOM - 2;
    adapter.onUpdate(marker, makeVehicle());
    expect(marker.icon.iconSize).toEqual([10, 10]);
  });
});
