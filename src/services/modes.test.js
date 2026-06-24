import { describe, it, expect } from 'vitest';
import {
  MODES,
  MODE_COLORS,
  MODE_ICONS,
  MODE_LABELS,
  ALL_MODE_IDS,
  GTFS_ROUTE_TYPE_TO_MODE,
  routeTypeToMode,
} from './modes';

describe('MODES canonical list', () => {
  it('defines id, label, color, and icon for every mode', () => {
    expect(MODES.length).toBeGreaterThan(0);
    for (const m of MODES) {
      expect(typeof m.id).toBe('string');
      expect(m.id.length).toBeGreaterThan(0);
      expect(typeof m.label).toBe('string');
      expect(m.label.length).toBeGreaterThan(0);
      expect(typeof m.color).toBe('string');
      expect(m.color.length).toBeGreaterThan(0);
      expect(typeof m.icon).toBe('string');
      expect(m.icon.length).toBeGreaterThan(0);
    }
  });

  it('does not include ship (no route_type maps to it)', () => {
    expect(ALL_MODE_IDS).not.toContain('ship');
  });

  it('includes all modes the GTFS mapping can emit', () => {
    const emittable = new Set(Object.values(GTFS_ROUTE_TYPE_TO_MODE));
    emittable.add('unknown');
    for (const mode of emittable) {
      expect(ALL_MODE_IDS).toContain(mode);
    }
  });

  it('every mode is either GTFS-emittable or a known non-GTFS mode', () => {
    // A mode no longer implies a GTFS origin: aircraft/helicopter come from
    // airplanes.live, not the GTFS route_type table.
    const emittable = new Set(Object.values(GTFS_ROUTE_TYPE_TO_MODE));
    emittable.add('unknown');
    const NON_GTFS_MODES = new Set(['aircraft', 'helicopter']);
    for (const id of ALL_MODE_IDS) {
      expect(emittable.has(id) || NON_GTFS_MODES.has(id)).toBe(true);
    }
  });

  it('includes aircraft and helicopter modes', () => {
    expect(ALL_MODE_IDS).toContain('aircraft');
    expect(ALL_MODE_IDS).toContain('helicopter');
  });

  it('does NOT extend the GTFS route_type table with aircraft modes', () => {
    expect(Object.values(GTFS_ROUTE_TYPE_TO_MODE)).not.toContain('aircraft');
    expect(Object.values(GTFS_ROUTE_TYPE_TO_MODE)).not.toContain('helicopter');
  });

  it('all mode ids are distinct', () => {
    expect(new Set(ALL_MODE_IDS).size).toBe(ALL_MODE_IDS.length);
  });
});

describe('MODE_COLORS, MODE_ICONS, MODE_LABELS lookups', () => {
  it('MODE_COLORS is derived from MODES — same entries', () => {
    for (const m of MODES) {
      expect(MODE_COLORS[m.id]).toBe(m.color);
    }
  });

  it('MODE_ICONS is derived from MODES — same entries', () => {
    for (const m of MODES) {
      expect(MODE_ICONS[m.id]).toBe(m.icon);
    }
  });

  it('MODE_LABELS is derived from MODES — same entries', () => {
    for (const m of MODES) {
      expect(MODE_LABELS[m.id]).toBe(m.label);
    }
  });
});

describe('routeTypeToMode — GTFS route_type examples', () => {
  const examples = [
    [0,    'tram'],
    [1,    'metro'],
    [2,    'train'],
    [3,    'bus'],
    [4,    'ferry'],
    [700,  'bus'],
    [900,  'tram'],
    [1000, 'ferry'],
  ];

  for (const [routeType, expected] of examples) {
    it(`route_type ${routeType} → ${expected}`, () => {
      expect(routeTypeToMode(routeType)).toBe(expected);
    });
  }

  it('unknown route_type degrades to "unknown"', () => {
    expect(routeTypeToMode(9999)).toBe('unknown');
    expect(routeTypeToMode(null)).toBe('unknown');
    expect(routeTypeToMode(undefined)).toBe('unknown');
    expect(routeTypeToMode('')).toBe('unknown');
  });
});
