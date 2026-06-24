import { describe, it, expect, vi, afterEach } from 'vitest';
import { mapAircraft, fetchAircraft } from './aircraft';

function makeAc(overrides = {}) {
  return {
    hex: '4ac9b2',
    flight: 'SAS123  ',
    r: 'SE-ABC',
    desc: 'Boeing 737-800',
    alt_baro: 35000,
    gs: 420.5,
    track: 180,
    lat: 59.3,
    lon: 18.0,
    category: 'A1',
    ...overrides,
  };
}

describe('mapAircraft — pure aircraft → Vehicle mapping', () => {
  it('maps an aircraft entry to a Vehicle with all required fields', () => {
    const [v] = mapAircraft([makeAc()]);
    expect(v.id).toBe('air:4ac9b2');
    expect(v.latitude).toBe(59.3);
    expect(v.longitude).toBe(18.0);
    expect(v.bearing).toBe(180);
    expect(v.speed).toBe(420.5);
    expect(v.line).toBe('SAS123');           // trailing spaces trimmed
    expect(v.mode).toBe('aircraft');
    expect(v.type).toBe('Boeing 737-800');
    expect(v.reg).toBe('SE-ABC');
    expect(v.altitude).toBe(35000);
  });

  it('has no operator (Aircraft is a Vehicle with no operator)', () => {
    const [v] = mapAircraft([makeAc()]);
    expect(v.operator).toBeUndefined();
  });

  it.each([
    ['A7', 'helicopter'],
    ['A1', 'aircraft'],
    ['A3', 'aircraft'],
    [undefined, 'aircraft'],
  ])('category %s → mode %s', (category, mode) => {
    const [v] = mapAircraft([makeAc({ category })]);
    expect(v.mode).toBe(mode);
  });

  it('drops an entry without a position (no lat/lon)', () => {
    const result = mapAircraft([
      makeAc({ hex: 'nopos', lat: undefined, lon: undefined }),
      makeAc(),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('air:4ac9b2');
  });

  it('tolerates missing optional fields', () => {
    const [v] = mapAircraft([
      { hex: 'abc', lat: 60, lon: 17 },
    ]);
    expect(v.id).toBe('air:abc');
    expect(v.bearing).toBe(0);
    expect(v.speed).toBe(0);
    expect(v.line).toBe('');
  });

  it('returns an empty array for a non-array / nullish input', () => {
    expect(mapAircraft(null)).toEqual([]);
    expect(mapAircraft(undefined)).toEqual([]);
    expect(mapAircraft({})).toEqual([]);
  });
});

describe('fetchAircraft', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('queries the point endpoint and maps the returned ac[]', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ac: [makeAc()] }),
    });
    const vehicles = await fetchAircraft({ lat: 59.3, lon: 18.0, radius: 100 });
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.calls[0][0]).toContain('59.3');
    expect(fetchSpy.mock.calls[0][0]).toContain('18');
    expect(fetchSpy.mock.calls[0][0]).toContain('100');
    expect(vehicles).toHaveLength(1);
    expect(vehicles[0].mode).toBe('aircraft');
  });

  it('caps the radius at 250 nm', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ac: [] }),
    });
    await fetchAircraft({ lat: 59.3, lon: 18.0, radius: 9999 });
    expect(fetchSpy.mock.calls[0][0]).toContain('250');
    expect(fetchSpy.mock.calls[0][0]).not.toContain('9999');
  });

  it('returns [] on a non-ok response (silent failure)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 503 });
    await expect(fetchAircraft({ lat: 59, lon: 18, radius: 100 })).resolves.toEqual([]);
  });

  it('returns [] when the fetch rejects (silent failure)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    await expect(fetchAircraft({ lat: 59, lon: 18, radius: 100 })).resolves.toEqual([]);
  });

  it('returns [] on a malformed response (no ac[])', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ unexpected: true }),
    });
    await expect(fetchAircraft({ lat: 59, lon: 18, radius: 100 })).resolves.toEqual([]);
  });
});
