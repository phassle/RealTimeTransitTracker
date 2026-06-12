import { describe, it, expect, vi } from 'vitest';
import { createWebcamAdapter, wireCameraPopup } from './webcamAdapter';
import { cameraPopupImageContent } from './webcamPopup';

vi.mock('leaflet', () => ({
  default: {
    divIcon: (opts) => ({ _type: 'divIcon', ...opts }),
  },
}));

const IMAGE_CAMERA = {
  id: 'trafikverket:tv-001',
  name: 'E4 Rotebro',
  type: 'traffic',
  media: 'image',
  lat: 59.47,
  lon: 17.95,
  imageUrl: 'https://example.test/cam/001.jpg',
  pageUrl: 'https://example.test/cam/001.html',
  source: 'trafikverket',
  attribution: 'Trafikverket',
  lastUpdated: '2026-06-11T12:00:00.000Z',
};

const LINKOUT_CAMERA = {
  id: 'webcamcollections:fjallbacka',
  name: 'Fjällbacka',
  type: 'weather',
  media: 'linkout',
  lat: 58.60,
  lon: 11.28,
  imageUrl: null,
  pageUrl: 'https://webcamcollections.com/countries/sweden/fjallbacka',
  source: 'webcamcollections',
  attribution: 'webcamcollections.com',
  lastUpdated: null,
};

function makeFakePopup(initialHtml) {
  const div = document.createElement('div');
  div.innerHTML = initialHtml;
  return {
    _div: div,
    getElement: () => div,
    setContent: vi.fn((html) => { div.innerHTML = html; }),
  };
}

// ─── Scenario 1: Webcams render through the shared collection ─────────────────

describe('createWebcamAdapter — adapter interface', () => {
  it('toLatLng returns [lat, lon] for a valid camera', () => {
    const adapter = createWebcamAdapter();
    expect(adapter.toLatLng(IMAGE_CAMERA)).toEqual([59.47, 17.95]);
  });

  it('toLatLng returns null when lat is falsy', () => {
    const adapter = createWebcamAdapter();
    expect(adapter.toLatLng({ ...IMAGE_CAMERA, lat: null })).toBeNull();
  });

  it('toLatLng returns null when lon is falsy', () => {
    const adapter = createWebcamAdapter();
    expect(adapter.toLatLng({ ...IMAGE_CAMERA, lon: 0 })).toBeNull();
  });

  it('toIcon returns a divIcon with the 📷 badge', () => {
    const adapter = createWebcamAdapter();
    const icon = adapter.toIcon(IMAGE_CAMERA);
    expect(icon._type).toBe('divIcon');
    expect(icon.html).toContain('📷');
  });

  it('toIcon uses the camera type color from CAMERA_TYPE_DEFINITIONS', () => {
    const adapter = createWebcamAdapter();
    const icon = adapter.toIcon(IMAGE_CAMERA); // type: 'traffic' → #e74c3c
    expect(icon.html).toContain('#e74c3c');
  });

  it('toIcon falls back to the default color for an unknown type', () => {
    const adapter = createWebcamAdapter();
    const icon = adapter.toIcon({ ...IMAGE_CAMERA, type: 'unknown-xyz' });
    expect(icon.html).toContain('#2c3e50');
  });

  it('toPopup for image camera renders <img> and refresh affordance', () => {
    const adapter = createWebcamAdapter();
    const html = adapter.toPopup(IMAGE_CAMERA);
    expect(html).toContain('<img');
    expect(html).toContain('data-webcam-refresh');
  });

  it('toPopup for linkout camera renders name and source link, no <img>', () => {
    const adapter = createWebcamAdapter();
    const html = adapter.toPopup(LINKOUT_CAMERA);
    expect(html).toContain('Fjällbacka');
    expect(html).not.toContain('<img');
  });

  it('toPopupOptions returns minWidth 240, maxWidth 320, closeButton true', () => {
    const adapter = createWebcamAdapter();
    const opts = adapter.toPopupOptions(IMAGE_CAMERA);
    expect(opts).toMatchObject({ closeButton: true, minWidth: 240, maxWidth: 320 });
  });

  it('toMarkerOptions includes title with escaped name and attribution', () => {
    const adapter = createWebcamAdapter();
    const opts = adapter.toMarkerOptions(IMAGE_CAMERA);
    expect(opts.title).toContain('E4 Rotebro');
    expect(opts.title).toContain('Trafikverket');
  });
});

// ─── Scenario 2: Popup refresh re-wires after content replacement ─────────────

describe('wireCameraPopup — refresh re-wires after content replacement', () => {
  it('updates popup content with a cache-busted URL on first refresh click', () => {
    const popup = makeFakePopup(cameraPopupImageContent(IMAGE_CAMERA));
    wireCameraPopup(popup, IMAGE_CAMERA);

    popup._div.querySelector('[data-webcam-refresh]').click();

    expect(popup.setContent).toHaveBeenCalledOnce();
    const html = popup.setContent.mock.calls[0][0];
    expect(html).toContain('_t=');
    expect(html).toContain('001.jpg');
  });

  it('remains functional after clicking refresh twice', () => {
    const div = document.createElement('div');
    div.innerHTML = cameraPopupImageContent(IMAGE_CAMERA);
    const popup = {
      _div: div,
      getElement: () => div,
      // setContent only replaces the DOM; the click handler re-wires after calling it.
      setContent: vi.fn((html) => { div.innerHTML = html; }),
    };

    wireCameraPopup(popup, IMAGE_CAMERA);

    div.querySelector('[data-webcam-refresh]').click();
    expect(popup.setContent).toHaveBeenCalledTimes(1);

    div.querySelector('[data-webcam-refresh]').click();
    expect(popup.setContent).toHaveBeenCalledTimes(2);
  });
});

// ─── Scenario 3: Image load failure shows the error placeholder ───────────────

describe('wireCameraPopup — image error shows placeholder', () => {
  it('replaces popup content with the error placeholder when the image errors', () => {
    const popup = makeFakePopup(cameraPopupImageContent(IMAGE_CAMERA));
    wireCameraPopup(popup, IMAGE_CAMERA);

    popup._div.querySelector('[data-webcam-image]').dispatchEvent(new Event('error'));

    expect(popup.setContent).toHaveBeenCalledOnce();
    const html = popup.setContent.mock.calls[0][0];
    expect(html.toLowerCase()).toMatch(/could not|failed|error|unavailable/);
    expect(html).not.toContain('<img');
  });

  it('error listener fires only once even if the image dispatches error again', () => {
    const popup = makeFakePopup(cameraPopupImageContent(IMAGE_CAMERA));
    wireCameraPopup(popup, IMAGE_CAMERA);

    const img = popup._div.querySelector('[data-webcam-image]');
    img.dispatchEvent(new Event('error'));
    img.dispatchEvent(new Event('error'));

    expect(popup.setContent).toHaveBeenCalledOnce();
  });

  it('rest of the popup remains usable after the error (name in placeholder)', () => {
    const popup = makeFakePopup(cameraPopupImageContent(IMAGE_CAMERA));
    wireCameraPopup(popup, IMAGE_CAMERA);

    popup._div.querySelector('[data-webcam-image]').dispatchEvent(new Event('error'));

    const html = popup.setContent.mock.calls[0][0];
    expect(html).toContain('E4 Rotebro');
  });
});

// ─── Scenario 4: linkout stays behind the embed boundary ─────────────────────

describe('createWebcamAdapter — linkout embed boundary', () => {
  it('toPopup for linkout renders no <iframe>, <embed>, or <video>', () => {
    const adapter = createWebcamAdapter();
    const html = adapter.toPopup(LINKOUT_CAMERA);
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('<embed');
    expect(html).not.toContain('<video');
  });

  it('toPopup for linkout includes a link to the source page', () => {
    const adapter = createWebcamAdapter();
    const html = adapter.toPopup(LINKOUT_CAMERA);
    expect(html).toContain('webcamcollections.com/countries/sweden/fjallbacka');
  });

  it('onMarkerCreated for linkout does NOT attach a popupopen listener', () => {
    const adapter = createWebcamAdapter();
    const marker = { on: vi.fn() };
    adapter.onMarkerCreated(marker, LINKOUT_CAMERA);
    expect(marker.on).not.toHaveBeenCalled();
  });

  it('onMarkerCreated for image camera attaches a popupopen listener', () => {
    const adapter = createWebcamAdapter();
    const marker = { on: vi.fn() };
    adapter.onMarkerCreated(marker, IMAGE_CAMERA);
    expect(marker.on).toHaveBeenCalledWith('popupopen', expect.any(Function));
  });
});
