import { describe, it, expect, vi, afterEach } from 'vitest';
import { mapAircraft, fetchAircraft, AIRPLANES_LIVE_MAX_RADIUS_NM } from './aircraft';

// One realistic airplanes.live entry, trimmed to the fields the mapping reads.
function rawAircraft(overrides = {}) {
  return {
    hex: '4ca7b1',
    flight: 'SAS123  ',
    lat: 59.33,
    lon: 18.07,
    track: 270,
    gs: 420,
    category: 'A3',
    desc: 'BOEING 737-800',
    r: 'SE-ABC',
    alt_baro: 35000,
    ...overrides,
  };
}

describe('mapAircraft — pure mapping into the Vehicle shape', () => {
  it('maps an aircraft entry into a Vehicle with no operator', () => {
    const [v] = mapAircraft([rawAircraft()]);
    expect(v.id).toBe('air:4ca7b1');
    expect(v.latitude).toBe(59.33);
    expect(v.longitude).toBe(18.07);
    expect(v.bearing).toBe(270);
    expect(v.speed).toBe(420);
    expect(v.operator).toBeUndefined();
  });

  it('carries the callsign as the line, trimmed of trailing spaces', () => {
    const [v] = mapAircraft([rawAircraft({ flight: 'SAS123  ' })]);
    expect(v.line).toBe('SAS123');
  });

  it('exposes type, registration and altitude for the popup', () => {
    const [v] = mapAircraft([rawAircraft()]);
    expect(v.type).toBe('BOEING 737-800');
    expect(v.reg).toBe('SE-ABC');
    expect(v.altitude).toBe(35000);
  });

  describe('category → mode', () => {
    const cases = [
      ['A7', 'helicopter'],
      ['A1', 'aircraft'],
      ['A3', 'aircraft'],
      ['', 'aircraft'],
      [undefined, 'aircraft'],
    ];
    for (const [category, mode] of cases) {
      it(`category ${JSON.stringify(category)} → ${mode}`, () => {
        const [v] = mapAircraft([rawAircraft({ category })]);
        expect(v.mode).toBe(mode);
      });
    }
  });

  it('drops entries without a current latitude/longitude', () => {
    const out = mapAircraft([
      rawAircraft({ hex: 'a', lat: 59, lon: 18 }),
      rawAircraft({ hex: 'b', lat: undefined, lon: 18 }),
      rawAircraft({ hex: 'c', lat: 59, lon: undefined }),
      rawAircraft({ hex: 'd', lat: undefined, lon: undefined }),
    ]);
    expect(out.map(v => v.id)).toEqual(['air:a']);
  });

  it('tolerates missing optional fields', () => {
    const [v] = mapAircraft([{ hex: 'x', lat: 59, lon: 18 }]);
    expect(v.id).toBe('air:x');
    expect(v.mode).toBe('aircraft');
    expect(v.bearing).toBe(0);
    expect(v.speed).toBe(0);
  });

  it('returns an empty array for a non-array input', () => {
    expect(mapAircraft(undefined)).toEqual([]);
    expect(mapAircraft(null)).toEqual([]);
  });
});

describe('fetchAircraft — thin client over airplanes.live', () => {
  afterEach(() => vi.restoreAllMocks());

  it('queries the point endpoint and returns mapped Vehicles', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ac: [rawAircraft()] }),
    });
    const out = await fetchAircraft({ lat: 59.33, lon: 18.07, radius: 100 });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('air:4ca7b1');
    const url = fetchSpy.mock.calls[0][0];
    expect(url).toContain('59.33');
    expect(url).toContain('18.07');
    expect(url).toContain('100');
  });

  it('caps the radius at the airplanes.live maximum', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ac: [] }),
    });
    await fetchAircraft({ lat: 59, lon: 18, radius: 9999 });
    const url = fetchSpy.mock.calls[0][0];
    expect(url).toContain(String(AIRPLANES_LIVE_MAX_RADIUS_NM));
    expect(url).not.toContain('9999');
  });

  it('resolves to [] when the response is not ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 503 });
    await expect(fetchAircraft({ lat: 59, lon: 18, radius: 50 })).resolves.toEqual([]);
  });

  it('resolves to [] when the fetch rejects (unreachable source)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    await expect(fetchAircraft({ lat: 59, lon: 18, radius: 50 })).resolves.toEqual([]);
  });

  it('resolves to [] when the response is malformed (no ac array)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ unexpected: true }),
    });
    await expect(fetchAircraft({ lat: 59, lon: 18, radius: 50 })).resolves.toEqual([]);
  });
});
