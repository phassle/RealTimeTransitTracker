import { describe, it, expect, vi, beforeEach } from 'vitest';
import { escapeHtml, createMarkerCollection } from './markerCollection';
import { vehiclePopupContent, createVehicleAdapter } from './vehicleAdapter';

// Leaflet mock — only the primitives used by vehicleAdapter
vi.mock('leaflet', () => ({
  default: {
    divIcon: (opts) => ({ _type: 'divIcon', ...opts }),
  },
}));

// Fake Leaflet layer — tracks which markers are currently present
function createFakeLayer() {
  const markers = new Set();
  return {
    markers,
    addLayer(m) { markers.add(m); },
    removeLayer(m) { markers.delete(m); },
  };
}

// Fake marker factory — records calls so tests can assert reuse vs. recreation
function makeFakeMarkerFactory() {
  const created = [];
  function createMarker(latLng, options) {
    const m = {
      latLng: [...latLng],
      options,
      popup: null,
      popupOptions: null,
      setLatLng(ll) { this.latLng = [...ll]; return this; },
      setPopupContent(c) { this.popup = c; return this; },
      bindPopup(c, opts) { this.popup = c; this.popupOptions = opts; return this; },
    };
    created.push(m);
    return m;
  }
  return { createMarker, created };
}

// Minimal fake adapter for lifecycle tests that don't need the full vehicle adapter
const fakeAdapter = {
  toLatLng: item => [item.lat, item.lon],
  toIcon: () => ({ _type: 'fake-icon' }),
  toPopup: item => `<p>${item.name}</p>`,
};

// Vehicle fixture
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

// ─── escapeHtml unit tests ───────────────────────────────────────────────────

describe('escapeHtml', () => {
  it('escapes < > & " characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('escapes apostrophe (stricter variant)', () => {
    expect(escapeHtml("O'Brien")).toBe("O&#39;Brien");
  });

  it('returns empty string for null', () => {
    expect(escapeHtml(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(escapeHtml(undefined)).toBe('');
  });

  it('converts non-strings to string then escapes', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});

// ─── Marker-collection lifecycle ─────────────────────────────────────────────

describe('createMarkerCollection — lifecycle', () => {
  it('adds a marker for each new item', () => {
    const layer = createFakeLayer();
    const { createMarker, created } = makeFakeMarkerFactory();
    const col = createMarkerCollection(layer, { createMarker });

    col.update([{ id: 'a', lat: 1, lon: 2, name: 'A' }], fakeAdapter);

    expect(created).toHaveLength(1);
    expect(layer.markers.size).toBe(1);
    expect(created[0].latLng).toEqual([1, 2]);
  });

  it('repositions an existing marker without creating a new one', () => {
    const layer = createFakeLayer();
    const { createMarker, created } = makeFakeMarkerFactory();
    const col = createMarkerCollection(layer, { createMarker });

    col.update([{ id: 'a', lat: 1, lon: 2, name: 'A' }], fakeAdapter);
    col.update([{ id: 'a', lat: 3, lon: 4, name: 'A moved' }], fakeAdapter);

    // Marker must be reused, not recreated
    expect(created).toHaveLength(1);
    expect(layer.markers.size).toBe(1);
    expect(created[0].latLng).toEqual([3, 4]);
  });

  it('removes a marker when its item disappears', () => {
    const layer = createFakeLayer();
    const { createMarker } = makeFakeMarkerFactory();
    const col = createMarkerCollection(layer, { createMarker });

    col.update([{ id: 'a', lat: 1, lon: 2, name: 'A' }], fakeAdapter);
    expect(layer.markers.size).toBe(1);

    col.update([], fakeAdapter);
    expect(layer.markers.size).toBe(0);
  });

  it('handles new, moved, and removed in one update', () => {
    const layer = createFakeLayer();
    const { createMarker, created } = makeFakeMarkerFactory();
    const col = createMarkerCollection(layer, { createMarker });

    col.update([
      { id: 'existing', lat: 1, lon: 2, name: 'Existing' },
    ], fakeAdapter);

    col.update([
      { id: 'existing', lat: 9, lon: 9, name: 'Moved' }, // repositioned
      { id: 'new',      lat: 5, lon: 5, name: 'New' },   // created
      // 'removed' not present → removed
    ], fakeAdapter);

    // Two markers total (existing reused + new created)
    expect(created).toHaveLength(2);
    expect(layer.markers.size).toBe(2);
    // 'existing' marker was repositioned
    expect(created[0].latLng).toEqual([9, 9]);
  });

  it('skips items that return null from toLatLng', () => {
    const layer = createFakeLayer();
    const { createMarker, created } = makeFakeMarkerFactory();
    const col = createMarkerCollection(layer, { createMarker });

    const adapterWithNull = {
      ...fakeAdapter,
      toLatLng: item => (item.lat && item.lon ? [item.lat, item.lon] : null),
    };

    col.update([
      { id: 'good',    lat: 59, lon: 18, name: 'Good' },
      { id: 'no-pos',  lat: null, lon: null, name: 'No position' },
      { id: 'undef',   name: 'Undefined coords' },
    ], adapterWithNull);

    expect(created).toHaveLength(1);
    expect(layer.markers.size).toBe(1);
  });

  it('calls adapter.onUpdate when provided instead of default setLatLng/setPopupContent', () => {
    const layer = createFakeLayer();
    const { createMarker, created } = makeFakeMarkerFactory();
    const col = createMarkerCollection(layer, { createMarker });

    const onUpdate = vi.fn();
    const adapterWithOnUpdate = { ...fakeAdapter, onUpdate };
    const item = { id: 'a', lat: 1, lon: 2, name: 'A' };

    col.update([item], adapterWithOnUpdate);
    col.update([{ ...item, lat: 3, lon: 4 }], adapterWithOnUpdate);

    expect(onUpdate).toHaveBeenCalledOnce();
    expect(onUpdate).toHaveBeenCalledWith(created[0], { ...item, lat: 3, lon: 4 });
  });

  it('clear() removes all markers from the layer', () => {
    const layer = createFakeLayer();
    const { createMarker } = makeFakeMarkerFactory();
    const col = createMarkerCollection(layer, { createMarker });

    col.update([
      { id: 'a', lat: 1, lon: 2, name: 'A' },
      { id: 'b', lat: 3, lon: 4, name: 'B' },
    ], fakeAdapter);
    expect(layer.markers.size).toBe(2);

    col.clear();
    expect(layer.markers.size).toBe(0);
  });
});

// ─── Scenario 1: Vehicles appear, move, and disappear (with vehicle adapter) ─

describe('createMarkerCollection — vehicle adapter integration', () => {
  it('creates markers for new vehicles, repositions moved ones, removes stale ones', () => {
    const layer = createFakeLayer();
    const { createMarker, created } = makeFakeMarkerFactory();
    const adapter = createVehicleAdapter();
    const col = createMarkerCollection(layer, { createMarker });

    const vA = makeVehicle({ id: 'vA', latitude: 59.3, longitude: 18.0 });
    const vB = makeVehicle({ id: 'vB', latitude: 59.4, longitude: 18.1 });

    // Initial: two vehicles
    col.update([vA, vB], adapter);
    expect(created).toHaveLength(2);
    expect(layer.markers.size).toBe(2);

    // Update: vA moves, vB removed, vC new
    const vA2 = { ...vA, latitude: 59.9, longitude: 18.9 };
    const vC  = makeVehicle({ id: 'vC', latitude: 60.0, longitude: 17.0 });

    col.update([vA2, vC], adapter);

    // Only one new marker created (vC); vA was reused
    expect(created).toHaveLength(3);
    expect(layer.markers.size).toBe(2);
    // vB's marker was removed
    expect(layer.markers.has(created[1])).toBe(false);
    // vA's marker was repositioned
    expect(created[0].latLng).toEqual([59.9, 18.9]);
  });
});

// ─── Scenario 2: Malicious feed data renders escaped in the vehicle popup ────

describe('vehiclePopupContent — HTML escaping', () => {
  it('escapes HTML markup in the line field', () => {
    const vehicle = makeVehicle({ line: '<script>alert(1)</script>' });
    const html = vehiclePopupContent(vehicle);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it("escapes apostrophes in the line name (stricter variant)", () => {
    const vehicle = makeVehicle({ line: "O'Briensvägen" });
    const html = vehiclePopupContent(vehicle);
    expect(html).toContain('O&#39;Briensv');
    expect(html).not.toContain("O'Briensvägen");
  });

  it('renders null line as empty text without throwing', () => {
    const vehicle = makeVehicle({ line: null });
    expect(() => vehiclePopupContent(vehicle)).not.toThrow();
    const html = vehiclePopupContent(vehicle);
    expect(html).not.toContain('null');
  });

  it('renders undefined mode as empty text without throwing', () => {
    const vehicle = makeVehicle({ mode: undefined });
    expect(() => vehiclePopupContent(vehicle)).not.toThrow();
    const html = vehiclePopupContent(vehicle);
    expect(html).not.toContain('undefined');
  });

  it('escapes HTML in the operator field', () => {
    const vehicle = makeVehicle({ operator: '<b>Evil</b>' });
    const html = vehiclePopupContent(vehicle);
    // operator is uppercased then escaped, so raw tags must not appear
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('<B>');
    expect(html).toMatch(/&lt;[Bb]&gt;/);
  });
});

// ─── Scenario 3: Vehicle without coordinates is skipped ──────────────────────

describe('vehicle adapter — coordinate validation', () => {
  it('returns null from toLatLng when latitude is missing', () => {
    const adapter = createVehicleAdapter();
    const v = makeVehicle({ latitude: null });
    expect(adapter.toLatLng(v)).toBeNull();
  });

  it('returns null from toLatLng when longitude is missing', () => {
    const adapter = createVehicleAdapter();
    const v = makeVehicle({ longitude: undefined });
    expect(adapter.toLatLng(v)).toBeNull();
  });

  it('collection skips vehicles without coordinates, renders others normally', () => {
    const layer = createFakeLayer();
    const { createMarker, created } = makeFakeMarkerFactory();
    const col = createMarkerCollection(layer, { createMarker });
    const adapter = createVehicleAdapter();

    col.update([
      makeVehicle({ id: 'good', latitude: 59.3, longitude: 18.0 }),
      makeVehicle({ id: 'no-lat', latitude: null }),
      makeVehicle({ id: 'no-lon', longitude: undefined }),
    ], adapter);

    expect(created).toHaveLength(1);
    expect(layer.markers.size).toBe(1);
  });
});
