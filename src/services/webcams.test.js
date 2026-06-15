import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchCameras } from './webcams';

// A representative Windy payload — minimal but realistic shape.
function windyPayload(cameras) {
  return { total: cameras.length, limit: 500, offset: 0, webcams: cameras };
}

const SAMPLE_WINDY_CAMERA = {
  webcamId: 'windy-se-001',
  title: 'Åre Mountain',
  status: 'active',
  lastUpdatedOn: '2026-06-12T08:00:00.000Z',
  location: {
    city: 'Åre',
    region: 'Jämtland',
    country: 'SE',
    latitude: 63.3996,
    longitude: 13.0755,
  },
  urls: {
    detail: 'https://www.windy.com/webcams/windy-se-001',
  },
};

// A representative Trafikverket payload — minimal but realistic shape.
function trafikverketPayload(cameras) {
  return {
    RESPONSE: {
      RESULT: [{ Camera: cameras }],
    },
  };
}

const SAMPLE_CAMERA = {
  Id: 'tv-001',
  Name: 'E4 Rotebro',
  PhotoUrl: 'https://example.trafikverket.test/cam/001.jpg',
  PhotoTime: '2026-06-11T12:00:00.000Z',
  Geometry: { WGS84: 'POINT (17.95 59.47)' },
  Type: 'Vägkamera',
  Active: true,
};

describe('webcams service — fetchCameras', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubEnv('VITE_TRAFIKVERKET_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('normalizes a Trafikverket Camera to the Camera model', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => trafikverketPayload([SAMPLE_CAMERA]),
    });

    const { cameras, errors } = await fetchCameras();
    const tv = cameras.filter(c => c.source === 'trafikverket');

    expect(errors).toEqual([]);
    expect(tv).toHaveLength(1);
    const cam = tv[0];
    expect(cam.name).toBe('E4 Rotebro');
    expect(cam.type).toBe('traffic');
    expect(cam.media).toBe('image');
    expect(cam.lat).toBeCloseTo(59.47);
    expect(cam.lon).toBeCloseTo(17.95);
    expect(cam.imageUrl).toBe('https://example.trafikverket.test/cam/001.jpg');
    expect(cam.source).toBe('trafikverket');
    expect(cam.attribution).toMatch(/Trafikverket/i);
    expect(cam.lastUpdated).toBe('2026-06-11T12:00:00.000Z');
    expect(typeof cam.id).toBe('string');
    expect(cam.id.length).toBeGreaterThan(0);
  });

  it('every camera carries media:image, type:traffic, source:trafikverket', async () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      ...SAMPLE_CAMERA,
      Id: `tv-${i}`,
      Name: `Cam ${i}`,
      Geometry: { WGS84: `POINT (${17 + i * 0.1} ${59 + i * 0.1})` },
    }));
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => trafikverketPayload(many),
    });

    const { cameras } = await fetchCameras();
    const tv = cameras.filter(c => c.source === 'trafikverket');

    expect(tv).toHaveLength(5);
    for (const cam of tv) {
      expect(cam.media).toBe('image');
      expect(cam.type).toBe('traffic');
      expect(cam.source).toBe('trafikverket');
    }
  });

  it('drops cameras without parseable WGS84 coordinates', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => trafikverketPayload([
        SAMPLE_CAMERA,
        { ...SAMPLE_CAMERA, Id: 'tv-bad', Geometry: { WGS84: 'POINT ()' } },
        { ...SAMPLE_CAMERA, Id: 'tv-nocoord', Geometry: null },
      ]),
    });

    const { cameras } = await fetchCameras();
    const tv = cameras.filter(c => c.source === 'trafikverket');

    expect(tv).toHaveLength(1);
    expect(tv[0].name).toBe('E4 Rotebro');
  });

  it('on HTTP error: zero Trafikverket cameras, surfaces error for the source', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 503 });

    const { cameras, errors } = await fetchCameras();
    const tv = cameras.filter(c => c.source === 'trafikverket');

    expect(tv).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].source).toBe('trafikverket');
    expect(errors[0].message).toMatch(/503|HTTP/i);
  });

  it('on network error: zero Trafikverket cameras, surfaces error for the source', async () => {
    fetch.mockRejectedValueOnce(new Error('network down'));

    const { cameras, errors } = await fetchCameras();
    const tv = cameras.filter(c => c.source === 'trafikverket');

    expect(tv).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].source).toBe('trafikverket');
    expect(errors[0].message).toMatch(/network down/i);
  });

  it('on malformed payload: zero Trafikverket cameras, surfaces error for the source', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ wat: true }),
    });

    const { cameras, errors } = await fetchCameras();
    const tv = cameras.filter(c => c.source === 'trafikverket');

    expect(tv).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].source).toBe('trafikverket');
  });

  it('returns a stable shape: { cameras, errors } even when both are empty', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => trafikverketPayload([]),
    });

    const result = await fetchCameras();
    expect(Object.keys(result).sort()).toEqual(['cameras', 'errors']);
    expect(Array.isArray(result.cameras)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it('combined list includes the curated webcamcollections cameras alongside Trafikverket', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => trafikverketPayload([SAMPLE_CAMERA]),
    });

    const { cameras, errors } = await fetchCameras();

    expect(errors).toEqual([]);
    // Trafikverket SAMPLE (1) + 89 curated entries = 90 total.
    expect(cameras.length).toBeGreaterThan(50);
    const sources = new Set(cameras.map(c => c.source));
    expect(sources.has('trafikverket')).toBe(true);
    expect(sources.has('webcamcollections')).toBe(true);
  });

  it('curated cameras are media:linkout (no image fetch) per ADR 0004', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => trafikverketPayload([]),
    });

    const { cameras } = await fetchCameras();
    const curated = cameras.filter(c => c.source === 'webcamcollections');
    expect(curated.length).toBeGreaterThan(0);
    for (const cam of curated) {
      expect(cam.media).toBe('linkout');
    }
  });

  it('curated cameras still ship when Trafikverket is down (per-source isolation)', async () => {
    fetch.mockRejectedValueOnce(new Error('network down'));

    const { cameras, errors } = await fetchCameras();

    const curated = cameras.filter(c => c.source === 'webcamcollections');
    expect(curated.length).toBeGreaterThan(0);
    // Trafikverket failure surfaces; the curated source still rendered.
    expect(errors.some(e => e.source === 'trafikverket')).toBe(true);
  });

  it('missing VITE_TRAFIKVERKET_API_KEY → absent source: zero cameras, no error, no fetch', async () => {
    vi.unstubAllEnvs();
    // Trafikverket key intentionally absent — keyless is configuration, not failure.

    const { cameras, errors } = await fetchCameras();

    expect(cameras.filter(c => c.source === 'trafikverket')).toEqual([]);
    expect(errors.some(e => e.source === 'trafikverket')).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    // The curated source still ships.
    expect(cameras.filter(c => c.source === 'webcamcollections').length).toBeGreaterThan(0);
  });
});

describe('webcams service — Windy adapter', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubEnv('VITE_TRAFIKVERKET_API_KEY', 'test-key');
    vi.stubEnv('VITE_WINDY_API_KEY', 'test-windy-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('normalizes a Windy camera to the Camera model', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => trafikverketPayload([]) })
      .mockResolvedValueOnce({ ok: true, json: async () => windyPayload([SAMPLE_WINDY_CAMERA]) });

    const { cameras, errors } = await fetchCameras();
    const windy = cameras.filter(c => c.source === 'windy');

    expect(errors).toEqual([]);
    expect(windy).toHaveLength(1);
    const cam = windy[0];
    expect(cam.name).toBe('Åre Mountain');
    expect(cam.type).toBe('weather');
    expect(cam.media).toBe('linkout');
    expect(cam.lat).toBeCloseTo(63.3996);
    expect(cam.lon).toBeCloseTo(13.0755);
    expect(cam.imageUrl).toBeNull();
    expect(cam.pageUrl).toBe('https://www.windy.com/webcams/windy-se-001');
    expect(cam.source).toBe('windy');
    expect(cam.attribution).toMatch(/Windy/i);
    expect(cam.lastUpdated).toBe('2026-06-12T08:00:00.000Z');
    expect(typeof cam.id).toBe('string');
    expect(cam.id.startsWith('windy:')).toBe(true);
  });

  it('all Windy cameras are media:linkout (terms do not permit static previews outside player)', async () => {
    const many = Array.from({ length: 3 }, (_, i) => ({
      ...SAMPLE_WINDY_CAMERA,
      webcamId: `windy-se-${i}`,
      title: `Camera ${i}`,
      location: { ...SAMPLE_WINDY_CAMERA.location, latitude: 60 + i * 0.1, longitude: 18 + i * 0.1 },
    }));
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => trafikverketPayload([]) })
      .mockResolvedValueOnce({ ok: true, json: async () => windyPayload(many) });

    const { cameras } = await fetchCameras();
    const windy = cameras.filter(c => c.source === 'windy');

    expect(windy).toHaveLength(3);
    for (const cam of windy) {
      expect(cam.media).toBe('linkout');
      expect(cam.imageUrl).toBeNull();
    }
  });

  it('drops Windy cameras without parseable coordinates', async () => {
    const good = SAMPLE_WINDY_CAMERA;
    const noLat = { ...SAMPLE_WINDY_CAMERA, webcamId: 'bad-1', location: { ...SAMPLE_WINDY_CAMERA.location, latitude: null } };
    const noCoords = { ...SAMPLE_WINDY_CAMERA, webcamId: 'bad-2', location: null };
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => trafikverketPayload([]) })
      .mockResolvedValueOnce({ ok: true, json: async () => windyPayload([good, noLat, noCoords]) });

    const { cameras } = await fetchCameras();
    const windy = cameras.filter(c => c.source === 'windy');

    expect(windy).toHaveLength(1);
    expect(windy[0].name).toBe('Åre Mountain');
  });

  it('Windy HTTP error → zero cameras from Windy, error surfaced', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => trafikverketPayload([SAMPLE_CAMERA]) })
      .mockResolvedValueOnce({ ok: false, status: 403 });

    const { cameras, errors } = await fetchCameras();

    expect(cameras.filter(c => c.source === 'windy')).toEqual([]);
    expect(errors.some(e => e.source === 'windy')).toBe(true);
    expect(errors.find(e => e.source === 'windy').message).toMatch(/403|HTTP/i);
  });

  it('Windy network error → zero cameras from Windy, error surfaced', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => trafikverketPayload([SAMPLE_CAMERA]) })
      .mockRejectedValueOnce(new Error('timeout'));

    const { cameras, errors } = await fetchCameras();

    expect(cameras.filter(c => c.source === 'windy')).toEqual([]);
    expect(errors.some(e => e.source === 'windy')).toBe(true);
    expect(errors.find(e => e.source === 'windy').message).toMatch(/timeout/i);
  });

  it('Windy malformed payload → zero cameras, error surfaced', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => trafikverketPayload([]) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ wat: true }) });

    const { cameras, errors } = await fetchCameras();

    expect(cameras.filter(c => c.source === 'windy')).toEqual([]);
    expect(errors.some(e => e.source === 'windy')).toBe(true);
  });

  it('Windy down — Trafikverket and curated cameras still render', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => trafikverketPayload([SAMPLE_CAMERA]) })
      .mockRejectedValueOnce(new Error('windy down'));

    const { cameras, errors } = await fetchCameras();

    expect(cameras.filter(c => c.source === 'trafikverket')).toHaveLength(1);
    expect(cameras.filter(c => c.source === 'webcamcollections').length).toBeGreaterThan(0);
    expect(errors.some(e => e.source === 'windy')).toBe(true);
    expect(errors.filter(e => e.source !== 'windy')).toEqual([]);
  });

  it('missing VITE_WINDY_API_KEY → zero Windy cameras, no error surfaced (optional integration)', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_TRAFIKVERKET_API_KEY', 'test-key');
    // Windy key intentionally absent
    fetch.mockResolvedValueOnce({ ok: true, json: async () => trafikverketPayload([SAMPLE_CAMERA]) });

    const { cameras, errors } = await fetchCameras();

    expect(cameras.filter(c => c.source === 'windy')).toEqual([]);
    expect(errors.some(e => e.source === 'windy')).toBe(false);
  });

  it('combined list includes Windy cameras alongside Trafikverket and curated', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => trafikverketPayload([SAMPLE_CAMERA]) })
      .mockResolvedValueOnce({ ok: true, json: async () => windyPayload([SAMPLE_WINDY_CAMERA]) });

    const { cameras, errors } = await fetchCameras();

    expect(errors).toEqual([]);
    const sources = new Set(cameras.map(c => c.source));
    expect(sources.has('trafikverket')).toBe(true);
    expect(sources.has('webcamcollections')).toBe(true);
    expect(sources.has('windy')).toBe(true);
  });
});
