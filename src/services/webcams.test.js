import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchCameras } from './webcams';

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

  it('curated cameras are media:linkout (no image fetch) per ADR 0002', async () => {
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
});
