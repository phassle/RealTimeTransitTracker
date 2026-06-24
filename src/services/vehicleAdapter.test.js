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
  it('renders the full marker with the type pictogram at or above FULL_MARKER_MIN_ZOOM', () => {
    const adapter = createVehicleAdapter({ getZoom: () => FULL_MARKER_MIN_ZOOM });
    const icon = adapter.toIcon(makeVehicle()); // bus
    expect(icon.html).toContain('🚌');          // vehicle-type pictogram, not the line number
    expect(icon.html).not.toContain('17');
    expect(icon.iconSize).toEqual([24, 24]);
    expect(icon.className).not.toContain('vehicle-marker--compact');
  });

  it('renders the compact marker as the type pictogram below FULL_MARKER_MIN_ZOOM', () => {
    const adapter = createVehicleAdapter({ getZoom: () => FULL_MARKER_MIN_ZOOM - 1 });
    const icon = adapter.toIcon(makeVehicle()); // bus
    expect(icon.html).toContain('🚌');          // still reads as a bus when zoomed out
    expect(icon.html).not.toContain('17');
    expect(icon.iconSize).toEqual([16, 16]);
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
    expect(marker.icon.iconSize).toEqual([16, 16]);
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

describe('createVehicleAdapter follow accent', () => {
  it('gives a followed vehicle a distinct follow visual-state key', () => {
    const adapter = createVehicleAdapter({
      getZoom: () => FULL_MARKER_MIN_ZOOM,
      isFollowed: (id) => id === 'v1',
    });
    const icon = adapter.toIcon(makeVehicle());
    expect(icon.className).toContain('vehicle-marker--followed');
  });

  it('keeps followed vehicles full-size even below the zoom threshold', () => {
    const adapter = createVehicleAdapter({
      getZoom: () => FULL_MARKER_MIN_ZOOM - 3,
      isFollowed: (id) => id === 'v1',
    });
    const icon = adapter.toIcon(makeVehicle());
    expect(icon.iconSize).toEqual([24, 24]);
  });

  it('composes the follow accent with the highlight rather than replacing it', () => {
    const adapter = createVehicleAdapter({
      getZoom: () => FULL_MARKER_MIN_ZOOM,
      isHighlighted: (id) => id === 'v1',
      isFollowed: (id) => id === 'v1',
    });
    const icon = adapter.toIcon(makeVehicle());
    // Follow and highlight are orthogonal — both accents present at once.
    expect(icon.className).toContain('vehicle-marker--highlighted');
    expect(icon.className).toContain('vehicle-marker--followed');
  });

  // Slice #171: following an already-highlighted Vehicle must layer the follow
  // accent on without erasing the gold highlight — the live transition, not just
  // the static composition above.
  it('adds the follow accent to an already-highlighted vehicle without dropping the highlight', () => {
    let followed = false;
    const adapter = createVehicleAdapter({
      getZoom: () => FULL_MARKER_MIN_ZOOM,
      isHighlighted: (id) => id === 'v1',
      isFollowed: () => followed,
    });
    const marker = {
      setLatLng: vi.fn().mockReturnThis(),
      setIcon: vi.fn().mockReturnThis(),
      isPopupOpen: () => false,
    };

    adapter.onMarkerCreated(marker, makeVehicle());
    followed = true;
    adapter.onUpdate(marker, makeVehicle());

    expect(marker.setIcon).toHaveBeenCalledOnce();
    const className = marker.setIcon.mock.calls[0][0].className;
    expect(className).toContain('vehicle-marker--highlighted');
    expect(className).toContain('vehicle-marker--followed');
  });

  it('replaces the icon when follow state changes', () => {
    let followed = false;
    const adapter = createVehicleAdapter({
      getZoom: () => FULL_MARKER_MIN_ZOOM,
      isFollowed: () => followed,
    });
    const marker = {
      setLatLng: vi.fn().mockReturnThis(),
      setIcon: vi.fn().mockReturnThis(),
      isPopupOpen: () => false,
    };

    adapter.onMarkerCreated(marker, makeVehicle());
    followed = true;
    adapter.onUpdate(marker, makeVehicle());

    expect(marker.setIcon).toHaveBeenCalledOnce();
    expect(marker.setIcon.mock.calls[0][0].className).toContain('vehicle-marker--followed');
  });

  it('defaults to nothing followed (existing map view behaviour)', () => {
    const adapter = createVehicleAdapter();
    const icon = adapter.toIcon(makeVehicle());
    expect(icon.className).not.toContain('vehicle-marker--followed');
  });
});

describe('createVehicleAdapter follow popup control', () => {
  it('offers a Follow control in the popup for a not-yet-followed vehicle', () => {
    const adapter = createVehicleAdapter();
    const popupContent = adapter.toPopup(makeVehicle());
    const marker = {};
    adapter.onMarkerCreated(marker, makeVehicle());
    expect(popupContent(marker)).toContain('Follow');
  });

  it('shows Stop following in the popup for the followed vehicle', () => {
    const adapter = createVehicleAdapter({ isFollowed: (id) => id === 'v1' });
    const popupContent = adapter.toPopup(makeVehicle());
    const marker = {};
    adapter.onMarkerCreated(marker, makeVehicle());
    expect(popupContent(marker)).toContain('Stop following');
  });

  it('invokes the follow toggle when the popup control is activated', () => {
    const onFollowToggle = vi.fn();
    const adapter = createVehicleAdapter({ onFollowToggle });
    const handlers = {};
    const button = { addEventListener: (ev, fn) => { handlers[ev] = fn; } };
    const popup = {
      getElement: () => ({ querySelector: (sel) => (sel.includes('follow') ? button : null) }),
    };
    const marker = {
      on: (ev, fn) => { if (ev === 'popupopen') fn({ popup }); },
    };

    adapter.onMarkerCreated(marker, makeVehicle());
    handlers.click({ preventDefault() {} });

    expect(onFollowToggle).toHaveBeenCalledWith('v1');
  });

  it('re-wires the follow control after a poll update replaces the open popup content', () => {
    const onFollowToggle = vi.fn();
    const adapter = createVehicleAdapter({ onFollowToggle });
    const makeButton = () => {
      const handlers = {};
      return {
        addEventListener: (ev, fn) => { handlers[ev] = fn; },
        click: () => handlers.click?.({ preventDefault() {} }),
      };
    };
    // setPopupContent replaces the button DOM node (new node, no listener),
    // mirroring real Leaflet — so without re-wiring the post-update button is
    // inert. getElement().querySelector always returns the CURRENT button.
    let currentButton = makeButton();
    const popup = {
      getElement: () => ({ querySelector: (sel) => (sel.includes('follow') ? currentButton : null) }),
    };
    const marker = {
      on: (ev, fn) => { if (ev === 'popupopen') fn({ popup }); },
      isPopupOpen: () => true,
      setLatLng: vi.fn().mockReturnThis(),
      setIcon: vi.fn().mockReturnThis(),
      setPopupContent: () => { currentButton = makeButton(); return marker; },
      getPopup: () => popup,
    };

    adapter.onMarkerCreated(marker, makeVehicle());       // popupopen wires button A
    adapter.onUpdate(marker, makeVehicle({ speed: 12 }));  // swaps to button B; fix re-wires it
    currentButton.click();                                 // click the post-update button (B)

    expect(onFollowToggle).toHaveBeenCalledWith('v1');
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

  it('renders an aircraft popup with callsign, type, reg, altitude, speed, bearing and no operator', () => {
    const adapter = createVehicleAdapter();
    const aircraft = {
      id: 'air:4ca7b1',
      mode: 'aircraft',
      line: 'SAS123',
      type: 'BOEING 737-800',
      reg: 'SE-ABC',
      altitude: 35000,
      latitude: 59.33,
      longitude: 18.07,
      bearing: 270,
      speed: 216,
      timestamp: 1700000000,
    };
    const marker = {};
    const popupContent = adapter.toPopup(aircraft);
    adapter.onMarkerCreated(marker, aircraft);
    const html = popupContent(marker);

    expect(html).toContain('SAS123');
    expect(html).toContain('BOEING 737-800');
    expect(html).toContain('SE-ABC');
    expect(html).toContain('35000');
    expect(html).toContain('Bearing: 270');
    // No operator line for an aircraft.
    expect(html).not.toContain('<em');
  });

  it('omits the Updated line for an aircraft (no feed timestamp) but keeps it for transit', () => {
    const adapter = createVehicleAdapter();
    const aircraftMarker = {};
    const aircraft = {
      id: 'air:4ca7b1', mode: 'aircraft', line: 'SAS123',
      latitude: 59.33, longitude: 18.07, bearing: 270, speed: 216,
      // no timestamp — aircraft carry none
    };
    const aircraftPopup = adapter.toPopup(aircraft);
    adapter.onMarkerCreated(aircraftMarker, aircraft);
    expect(aircraftPopup(aircraftMarker)).not.toContain('Updated:');

    const transitMarker = {};
    const transitPopup = adapter.toPopup(makeVehicle());
    adapter.onMarkerCreated(transitMarker, makeVehicle());
    expect(transitPopup(transitMarker)).toContain('Updated:');
  });

  it('renders the helicopter glyph (🚁) on the marker icon for a helicopter Vehicle', () => {
    const adapter = createVehicleAdapter();
    const icon = adapter.toIcon({
      id: 'air:1', mode: 'helicopter', line: 'POL01', latitude: 59, longitude: 18,
    });
    expect(icon.html).toContain('🚁');
  });

  it('omits type/reg/altitude lines when the Vehicle has none (transit Vehicle)', () => {
    const adapter = createVehicleAdapter();
    const marker = {};
    const popupContent = adapter.toPopup(makeVehicle());
    adapter.onMarkerCreated(marker, makeVehicle());
    const html = popupContent(marker);
    expect(html).not.toContain('Type:');
    expect(html).not.toContain('Reg:');
    expect(html).not.toContain('Altitude:');
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
