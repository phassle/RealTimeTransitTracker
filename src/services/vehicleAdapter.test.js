import { describe, it, expect, vi } from 'vitest';
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

  it('skips icon replacement when the visual state is unchanged', () => {
    const adapter = createVehicleAdapter({ getZoom: () => FULL_MARKER_MIN_ZOOM });
    const marker = {
      setLatLng: vi.fn().mockReturnThis(),
      setIcon: vi.fn().mockReturnThis(),
      isPopupOpen: () => false,
    };

    adapter.onMarkerCreated(marker, makeVehicle());
    adapter.onUpdate(marker, makeVehicle({ latitude: 59.34, longitude: 18.08, speed: 14 }));

    expect(marker.setLatLng).toHaveBeenCalledWith([59.34, 18.08]);
    expect(marker.setIcon).not.toHaveBeenCalled();
  });

  it('replaces the icon when the visual state changes', () => {
    let highlighted = false;
    const adapter = createVehicleAdapter({
      getZoom: () => FULL_MARKER_MIN_ZOOM,
      isHighlighted: () => highlighted,
    });
    const marker = {
      setLatLng: vi.fn().mockReturnThis(),
      setIcon: vi.fn().mockReturnThis(),
      isPopupOpen: () => false,
    };

    adapter.onMarkerCreated(marker, makeVehicle());
    highlighted = true;
    adapter.onUpdate(marker, makeVehicle());

    expect(marker.setIcon).toHaveBeenCalledOnce();
    expect(marker.setIcon.mock.calls[0][0].className).toContain('vehicle-marker--highlighted');
  });
});

describe('createVehicleAdapter downstream prediction accent', () => {
  it('accents predicted (downstream) vehicles distinctly from highlighted ones', () => {
    const adapter = createVehicleAdapter({
      getZoom: () => FULL_MARKER_MIN_ZOOM,
      isPredicted: (id) => id === 'v1',
    });
    const icon = adapter.toIcon(makeVehicle());

    // A prediction must never read as the observed selection/highlight.
    expect(icon.className).toContain('vehicle-marker--predicted');
    expect(icon.className).not.toContain('vehicle-marker--highlighted');
  });

  it('keeps predicted vehicles full-size even below the zoom threshold', () => {
    const adapter = createVehicleAdapter({
      getZoom: () => FULL_MARKER_MIN_ZOOM - 3,
      isPredicted: (id) => id === 'v1',
    });
    const icon = adapter.toIcon(makeVehicle());
    expect(icon.iconSize).toEqual([24, 24]);
  });

  it('lets the selection/highlight win when a vehicle is both highlighted and predicted', () => {
    const adapter = createVehicleAdapter({
      getZoom: () => FULL_MARKER_MIN_ZOOM,
      isHighlighted: (id) => id === 'v1',
      isPredicted: (id) => id === 'v1',
    });
    const icon = adapter.toIcon(makeVehicle());
    expect(icon.className).toContain('vehicle-marker--highlighted');
    expect(icon.className).not.toContain('vehicle-marker--predicted');
  });

  it('replaces the icon when prediction state changes', () => {
    let predicted = false;
    const adapter = createVehicleAdapter({
      getZoom: () => FULL_MARKER_MIN_ZOOM,
      isPredicted: () => predicted,
    });
    const marker = {
      setLatLng: vi.fn().mockReturnThis(),
      setIcon: vi.fn().mockReturnThis(),
      isPopupOpen: () => false,
    };

    adapter.onMarkerCreated(marker, makeVehicle());
    predicted = true;
    adapter.onUpdate(marker, makeVehicle());

    expect(marker.setIcon).toHaveBeenCalledOnce();
    expect(marker.setIcon.mock.calls[0][0].className).toContain('vehicle-marker--predicted');
  });

  it('defaults to nothing predicted (existing map view behaviour)', () => {
    const adapter = createVehicleAdapter();
    const icon = adapter.toIcon(makeVehicle());
    expect(icon.className).not.toContain('vehicle-marker--predicted');
  });
});

describe('createVehicleAdapter lazy popups', () => {
  it('defers vehicle popup formatting until Leaflet resolves popup content', () => {
    const adapter = createVehicleAdapter();
    const marker = {};
    const timeSpy = vi.spyOn(Date.prototype, 'toLocaleTimeString');

    const popupContent = adapter.toPopup(makeVehicle());

    expect(typeof popupContent).toBe('function');
    expect(timeSpy).not.toHaveBeenCalled();

    adapter.onMarkerCreated(marker, makeVehicle());
    popupContent(marker);

    expect(timeSpy).toHaveBeenCalledOnce();
    timeSpy.mockRestore();
  });

  it('renders the latest vehicle state when a lazy popup is opened later', () => {
    const adapter = createVehicleAdapter();
    const marker = {
      setLatLng: vi.fn().mockReturnThis(),
      setIcon: vi.fn().mockReturnThis(),
      isPopupOpen: () => false,
    };
    const popupContent = adapter.toPopup(makeVehicle({ line: '17' }));

    adapter.onMarkerCreated(marker, makeVehicle({ line: '17' }));
    adapter.onUpdate(marker, makeVehicle({ line: '18' }));

    expect(popupContent(marker)).toContain('bus 18');
  });

  it('refreshes popup content only when the popup is open', () => {
    const adapter = createVehicleAdapter();
    let open = false;
    const marker = {
      setLatLng: vi.fn().mockReturnThis(),
      setPopupContent: vi.fn().mockReturnThis(),
      setIcon: vi.fn().mockReturnThis(),
      isPopupOpen: () => open,
    };

    adapter.onMarkerCreated(marker, makeVehicle());
    adapter.onUpdate(marker, makeVehicle({ speed: 12 }));
    expect(marker.setPopupContent).not.toHaveBeenCalled();

    open = true;
    adapter.onUpdate(marker, makeVehicle({ speed: 13 }));
    expect(marker.setPopupContent).toHaveBeenCalledOnce();
    expect(typeof marker.setPopupContent.mock.calls[0][0]).toBe('function');
  });
});
