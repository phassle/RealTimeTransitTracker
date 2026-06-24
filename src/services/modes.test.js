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

  it('every mode in the list is emittable (no permanently-empty filter)', () => {
    const emittable = new Set(Object.values(GTFS_ROUTE_TYPE_TO_MODE));
    emittable.add('unknown');
    // aircraft/helicopter are emitted by the airplanes.live mapping, not GTFS
    // (a mode no longer implies a GTFS origin — PRD #165).
    emittable.add('aircraft');
    emittable.add('helicopter');
    for (const id of ALL_MODE_IDS) {
      expect(emittable).toContain(id);
    }
  });

  it('includes aircraft (✈) and helicopter (🚁) modes', () => {
    const aircraft = MODES.find(m => m.id === 'aircraft');
    const helicopter = MODES.find(m => m.id === 'helicopter');
    expect(aircraft).toBeTruthy();
    expect(aircraft.icon).toBe('✈');
    expect(helicopter).toBeTruthy();
    expect(helicopter.icon).toBe('🚁');
  });

  it('does not give aircraft modes a GTFS route_type entry (mode ≠ GTFS origin)', () => {
    const gtfsModes = new Set(Object.values(GTFS_ROUTE_TYPE_TO_MODE));
    expect(gtfsModes).not.toContain('aircraft');
    expect(gtfsModes).not.toContain('helicopter');
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
