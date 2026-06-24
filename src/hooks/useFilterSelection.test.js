import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFilterSelection } from './useFilterSelection';

const FAVOURITES_STORAGE_KEY = 'rtt-favourite-lines-v1';

const v = (id, mode, line) => ({ id, mode, line });

describe('useFilterSelection — initial state', () => {
  it('all modes enabled and no lines selected', () => {
    const { result } = renderHook(() => useFilterSelection([]));
    expect(result.current.enabledModes.length).toBeGreaterThan(0);
    expect(result.current.selectedLines).toHaveLength(0);
    expect(result.current.filteredVehicles).toHaveLength(0);
  });

  it('exposes toggleMode, toggleLine, clearLines, isLineSelected, availableLines, filteredVehicles', () => {
    const { result } = renderHook(() => useFilterSelection([]));
    const keys = Object.keys(result.current).sort();
    expect(keys).toContain('enabledModes');
    expect(keys).toContain('toggleMode');
    expect(keys).toContain('selectedLines');
    expect(keys).toContain('isLineSelected');
    expect(keys).toContain('toggleLine');
    expect(keys).toContain('clearLines');
    expect(keys).toContain('availableLines');
    expect(keys).toContain('filteredVehicles');
  });
});

describe('useFilterSelection — Scenario: Toggling a line filters vehicles end-to-end', () => {
  it('all vehicles visible before any line selected', () => {
    const vehicles = [v('v1', 'bus', '4'), v('v2', 'bus', '53')];
    const { result } = renderHook(() => useFilterSelection(vehicles));
    expect(result.current.filteredVehicles).toHaveLength(2);
  });

  it('selecting a line narrows filteredVehicles to that line', () => {
    const vehicles = [v('v1', 'bus', '4'), v('v2', 'bus', '53')];
    const { result } = renderHook(() => useFilterSelection(vehicles));

    act(() => result.current.toggleLine('bus', '4'));

    expect(result.current.filteredVehicles).toHaveLength(1);
    expect(result.current.filteredVehicles[0].id).toBe('v1');
  });

  it('toggling the line again deselects it and restores all vehicles', () => {
    const vehicles = [v('v1', 'bus', '4'), v('v2', 'bus', '53')];
    const { result } = renderHook(() => useFilterSelection(vehicles));

    act(() => result.current.toggleLine('bus', '4'));
    act(() => result.current.toggleLine('bus', '4'));

    expect(result.current.filteredVehicles).toHaveLength(2);
  });

  it('selectedLines are {mode, line} objects — no colon-key strings', () => {
    const vehicles = [v('v1', 'bus', '4')];
    const { result } = renderHook(() => useFilterSelection(vehicles));

    act(() => result.current.toggleLine('bus', '4'));

    const sl = result.current.selectedLines;
    expect(sl).toHaveLength(1);
    expect(sl[0]).toMatchObject({ mode: 'bus', line: '4' });
    expect(typeof sl[0]).not.toBe('string');
  });

  it('isLineSelected returns true for selected, false otherwise', () => {
    const vehicles = [v('v1', 'bus', '4'), v('v2', 'bus', '53')];
    const { result } = renderHook(() => useFilterSelection(vehicles));

    act(() => result.current.toggleLine('bus', '4'));

    expect(result.current.isLineSelected('bus', '4')).toBe(true);
    expect(result.current.isLineSelected('bus', '53')).toBe(false);
  });
});

describe('useFilterSelection — Scenario Outline: Available lines grouped and numerically sorted', () => {
  it.each([
    [['10', '2', '1'],    ['1', '2', '10']],
    [['53', '4', '172'],  ['4', '53', '172']],
    [['17A', '3', '17'],  ['3', '17', '17A']],
  ])('lines %s sort to %s', (input, expected) => {
    const vehicles = input.map((line, i) => v(`v${i}`, 'bus', line));
    const { result } = renderHook(() => useFilterSelection(vehicles));
    const lines = result.current.availableLines.bus?.map(l => l.line) ?? [];
    expect(lines).toEqual(expected);
  });

  it('available lines are grouped by mode', () => {
    const vehicles = [v('v1', 'bus', '4'), v('v2', 'tram', '7')];
    const { result } = renderHook(() => useFilterSelection(vehicles));
    expect(result.current.availableLines).toHaveProperty('bus');
    expect(result.current.availableLines).toHaveProperty('tram');
    expect(result.current.availableLines.bus[0].line).toBe('4');
    expect(result.current.availableLines.tram[0].line).toBe('7');
  });

  it('each line entry has line and count', () => {
    const vehicles = [v('v1', 'bus', '4'), v('v2', 'bus', '4'), v('v3', 'bus', '53')];
    const { result } = renderHook(() => useFilterSelection(vehicles));
    const busLines = result.current.availableLines.bus;
    const line4 = busLines.find(l => l.line === '4');
    expect(line4).toBeDefined();
    expect(line4.count).toBe(2);
  });

  it('disabled mode does not appear in availableLines', () => {
    const vehicles = [v('v1', 'bus', '4'), v('v2', 'tram', '7')];
    const { result } = renderHook(() => useFilterSelection(vehicles));

    act(() => result.current.toggleMode('tram'));

    expect(result.current.availableLines).not.toHaveProperty('tram');
  });
});

describe('useFilterSelection — Scenario: Line selector lists transit lines only, never callsigns (issue #169)', () => {
  // A callsign is not a Line (CONTEXT.md). Aircraft/helicopter Vehicles carry a
  // callsign in `line`, but they must never appear in the line selector — only
  // transit lines do. Aircraft stay filterable by MODE.
  it('aircraft and helicopter modes never appear in availableLines, even when present', () => {
    const vehicles = [
      v('v1', 'bus', '4'),
      v('v2', 'train', '41'),
      v('air:abc', 'aircraft', 'SAS123'),
      v('air:def', 'helicopter', 'POL01'),
    ];
    const { result } = renderHook(() => useFilterSelection(vehicles));

    expect(result.current.availableLines).toHaveProperty('bus');
    expect(result.current.availableLines).toHaveProperty('train');
    expect(result.current.availableLines).not.toHaveProperty('aircraft');
    expect(result.current.availableLines).not.toHaveProperty('helicopter');
  });

  it('no aircraft callsign is listed as a selectable line', () => {
    const vehicles = [
      v('v1', 'bus', '4'),
      v('air:abc', 'aircraft', 'SAS123'),
    ];
    const { result } = renderHook(() => useFilterSelection(vehicles));

    const allListedLines = Object.values(result.current.availableLines)
      .flat()
      .map(l => l.line);
    expect(allListedLines).not.toContain('SAS123');
  });

  it('aircraft and helicopter remain listed as mode toggles', () => {
    const vehicles = [v('air:abc', 'aircraft', 'SAS123')];
    const { result } = renderHook(() => useFilterSelection(vehicles));

    expect(result.current.enabledModes).toContain('aircraft');
    expect(result.current.enabledModes).toContain('helicopter');
  });

  it('toggling the aircraft mode still hides aircraft Vehicles', () => {
    const vehicles = [v('v1', 'bus', '4'), v('air:abc', 'aircraft', 'SAS123')];
    const { result } = renderHook(() => useFilterSelection(vehicles));

    expect(result.current.filteredVehicles).toHaveLength(2);

    act(() => result.current.toggleMode('aircraft'));

    expect(result.current.filteredVehicles.map(x => x.id)).toEqual(['v1']);
  });
});

describe('useFilterSelection — Scenario: Disabling a mode clears its selected lines', () => {
  it('selected line disappears from selectedLines when its mode is disabled', () => {
    const vehicles = [v('v1', 'bus', '4')];
    const { result } = renderHook(() => useFilterSelection(vehicles));

    act(() => result.current.toggleLine('bus', '4'));
    expect(result.current.isLineSelected('bus', '4')).toBe(true);

    act(() => result.current.toggleMode('bus'));

    expect(result.current.selectedLines).toHaveLength(0);
    expect(result.current.isLineSelected('bus', '4')).toBe(false);
  });

  it('disabling a mode hides its vehicles', () => {
    const vehicles = [v('v1', 'bus', '4')];
    const { result } = renderHook(() => useFilterSelection(vehicles));

    act(() => result.current.toggleMode('bus'));

    expect(result.current.filteredVehicles).toHaveLength(0);
  });

  it('re-enabling a mode shows all its vehicles with no lines pre-selected', () => {
    const vehicles = [v('v1', 'bus', '4'), v('v2', 'bus', '53')];
    const { result } = renderHook(() => useFilterSelection(vehicles));

    act(() => result.current.toggleLine('bus', '4'));
    act(() => result.current.toggleMode('bus'));   // disable → clears lines
    act(() => result.current.toggleMode('bus'));   // re-enable

    expect(result.current.filteredVehicles).toHaveLength(2);
    expect(result.current.isLineSelected('bus', '4')).toBe(false);
  });

  it('disabling one mode does not clear selected lines from another mode', () => {
    const vehicles = [v('v1', 'bus', '4'), v('v2', 'tram', '7')];
    const { result } = renderHook(() => useFilterSelection(vehicles));

    act(() => result.current.toggleLine('bus', '4'));
    act(() => result.current.toggleLine('tram', '7'));

    act(() => result.current.toggleMode('tram'));

    expect(result.current.isLineSelected('bus', '4')).toBe(true);
    expect(result.current.isLineSelected('tram', '7')).toBe(false);
  });
});

describe('useFilterSelection — Scenario: Line selection for a disabled mode has no effect', () => {
  it('toggleLine is ignored for a disabled mode', () => {
    const vehicles = [v('v1', 'tram', '7')];
    const { result } = renderHook(() => useFilterSelection(vehicles));

    act(() => result.current.toggleMode('tram'));

    const selectionBefore = result.current.selectedLines.length;
    act(() => result.current.toggleLine('tram', '7'));

    expect(result.current.selectedLines).toHaveLength(selectionBefore);
    expect(result.current.isLineSelected('tram', '7')).toBe(false);
    expect(result.current.filteredVehicles).toHaveLength(0);
  });
});

describe('useFilterSelection — clearLines', () => {
  it('clears all selected lines across modes', () => {
    const vehicles = [v('v1', 'bus', '4'), v('v2', 'bus', '53'), v('v3', 'tram', '7')];
    const { result } = renderHook(() => useFilterSelection(vehicles));

    act(() => {
      result.current.toggleLine('bus', '4');
      result.current.toggleLine('bus', '53');
      result.current.toggleLine('tram', '7');
    });
    expect(result.current.selectedLines).toHaveLength(3);

    act(() => result.current.clearLines());

    expect(result.current.selectedLines).toHaveLength(0);
    expect(result.current.filteredVehicles).toHaveLength(3);
  });
});

describe('useFilterSelection — Favourites', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('exposes isLineFavourite and toggleFavourite', () => {
    const { result } = renderHook(() => useFilterSelection([]));
    expect(typeof result.current.isLineFavourite).toBe('function');
    expect(typeof result.current.toggleFavourite).toBe('function');
  });

  it('no line is favourited initially', () => {
    const { result } = renderHook(() => useFilterSelection([v('v1', 'bus', '55')]));
    expect(result.current.isLineFavourite('bus', '55')).toBe(false);
  });

  it('toggleFavourite marks a line as a Favourite', () => {
    const { result } = renderHook(() => useFilterSelection([v('v1', 'bus', '55')]));

    act(() => result.current.toggleFavourite('bus', '55'));

    expect(result.current.isLineFavourite('bus', '55')).toBe(true);
  });

  it('toggling a favourited line again clears the Favourite', () => {
    const { result } = renderHook(() => useFilterSelection([v('v1', 'bus', '55')]));

    act(() => result.current.toggleFavourite('bus', '55'));
    act(() => result.current.toggleFavourite('bus', '55'));

    expect(result.current.isLineFavourite('bus', '55')).toBe(false);
  });

  it('favouriting a line does not select it (orthogonal axes)', () => {
    const { result } = renderHook(() => useFilterSelection([v('v1', 'bus', '55')]));

    act(() => result.current.toggleFavourite('bus', '55'));

    expect(result.current.isLineFavourite('bus', '55')).toBe(true);
    expect(result.current.isLineSelected('bus', '55')).toBe(false);
  });

  it('selecting a line does not favourite it (orthogonal axes)', () => {
    const { result } = renderHook(() => useFilterSelection([v('v1', 'bus', '55')]));

    act(() => result.current.toggleLine('bus', '55'));

    expect(result.current.isLineSelected('bus', '55')).toBe(true);
    expect(result.current.isLineFavourite('bus', '55')).toBe(false);
  });

  it('disabling a mode keeps its Favourites', () => {
    const { result } = renderHook(() => useFilterSelection([v('v1', 'bus', '55')]));

    act(() => result.current.toggleFavourite('bus', '55'));
    act(() => result.current.toggleMode('bus'));

    expect(result.current.isLineFavourite('bus', '55')).toBe(true);
  });

  it('favourites are scoped per mode and line', () => {
    const { result } = renderHook(() => useFilterSelection([]));

    act(() => result.current.toggleFavourite('bus', '55'));

    expect(result.current.isLineFavourite('tram', '55')).toBe(false);
    expect(result.current.isLineFavourite('bus', '5')).toBe(false);
  });
});

describe('useFilterSelection — Favourites seed Selection on load', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  // Seed the persisted Favourites as if pinned on a previous visit.
  const favourite = (mode, line) =>
    window.localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify([{ mode, line }]));

  it('Favourites are pre-selected on a fresh load', () => {
    favourite('bus', '55');
    const { result } = renderHook(() => useFilterSelection([v('v1', 'bus', '55'), v('v2', 'bus', '4')]));

    expect(result.current.isLineSelected('bus', '55')).toBe(true);
    expect(result.current.filteredVehicles).toHaveLength(1);
    expect(result.current.filteredVehicles[0].id).toBe('v1');
  });

  it('deselecting a seeded line this session keeps it favourited', () => {
    favourite('bus', '55');
    const { result } = renderHook(() => useFilterSelection([v('v1', 'bus', '55')]));

    act(() => result.current.toggleLine('bus', '55'));

    expect(result.current.isLineSelected('bus', '55')).toBe(false);
    expect(result.current.isLineFavourite('bus', '55')).toBe(true);
  });

  it('a deselected favourite is re-selected on the next fresh load', () => {
    favourite('bus', '55');
    const first = renderHook(() => useFilterSelection([v('v1', 'bus', '55')]));
    act(() => first.result.current.toggleLine('bus', '55'));
    expect(first.result.current.isLineSelected('bus', '55')).toBe(false);
    first.unmount();

    const second = renderHook(() => useFilterSelection([v('v1', 'bus', '55')]));
    expect(second.result.current.isLineSelected('bus', '55')).toBe(true);
  });

  it('deselecting a seeded line does not re-seed it later in the same session', () => {
    favourite('bus', '55');
    const { result, rerender } = renderHook(() => useFilterSelection([v('v1', 'bus', '55')]));

    act(() => result.current.toggleLine('bus', '55'));
    rerender();

    expect(result.current.isLineSelected('bus', '55')).toBe(false);
  });

  it('disabling a mode clears its selections but keeps its favourites', () => {
    favourite('bus', '55');
    const { result } = renderHook(() => useFilterSelection([v('v1', 'bus', '55')]));
    expect(result.current.isLineSelected('bus', '55')).toBe(true);

    act(() => result.current.toggleMode('bus'));

    expect(result.current.isLineSelected('bus', '55')).toBe(false);
    expect(result.current.isLineFavourite('bus', '55')).toBe(true);
  });

  it('a favourite with no live vehicles still shows as a selected chip', () => {
    favourite('bus', '55');
    const { result } = renderHook(() => useFilterSelection([v('v1', 'bus', '4')]));

    expect(result.current.isLineSelected('bus', '55')).toBe(true);
    expect(result.current.selectedLines).toContainEqual({ mode: 'bus', line: '55' });
  });
});

describe('useFilterSelection — clearFavourites', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('exposes clearFavourites', () => {
    const { result } = renderHook(() => useFilterSelection([]));
    expect(typeof result.current.clearFavourites).toBe('function');
  });

  // Scenario: Clear favourites wipes all pins
  it('wipes all pins across modes', () => {
    const { result } = renderHook(() => useFilterSelection([]));
    act(() => result.current.toggleFavourite('bus', '55'));
    act(() => result.current.toggleFavourite('train', '41'));
    expect(result.current.isLineFavourite('bus', '55')).toBe(true);
    expect(result.current.isLineFavourite('train', '41')).toBe(true);

    act(() => result.current.clearFavourites());

    expect(result.current.isLineFavourite('bus', '55')).toBe(false);
    expect(result.current.isLineFavourite('train', '41')).toBe(false);
  });

  // ...And on the next fresh load no line is pre-selected from favourites
  it('write-through: cleared pins do not pre-select on a fresh load', () => {
    const first = renderHook(() => useFilterSelection([]));
    act(() => first.result.current.toggleFavourite('bus', '55'));
    act(() => first.result.current.toggleFavourite('train', '41'));
    act(() => first.result.current.clearFavourites());
    first.unmount();

    const second = renderHook(() => useFilterSelection([]));
    expect(second.result.current.isLineFavourite('bus', '55')).toBe(false);
    expect(second.result.current.selectedLines).toHaveLength(0);
  });

  // Scenario: Clear favourites leaves the session Selection intact
  it('leaves the session Selection untouched', () => {
    const vehicles = [v('v1', 'bus', '55'), v('v2', 'bus', '7')];
    const { result } = renderHook(() => useFilterSelection(vehicles));
    act(() => {
      result.current.toggleFavourite('bus', '55');
      result.current.toggleLine('bus', '55');
      result.current.toggleLine('bus', '7');
    });
    expect(result.current.isLineSelected('bus', '55')).toBe(true);
    expect(result.current.isLineSelected('bus', '7')).toBe(true);

    act(() => result.current.clearFavourites());

    expect(result.current.isLineFavourite('bus', '55')).toBe(false);
    expect(result.current.isLineSelected('bus', '55')).toBe(true);
    expect(result.current.isLineSelected('bus', '7')).toBe(true);
  });
});

describe('useFilterSelection — Favourites persist across reloads', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('a favourite survives unmount and remount', () => {
    const vehicles = [v('v1', 'bus', '55')];
    const first = renderHook(() => useFilterSelection(vehicles));
    act(() => first.result.current.toggleFavourite('bus', '55'));
    first.unmount();

    const second = renderHook(() => useFilterSelection(vehicles));
    expect(second.result.current.isLineFavourite('bus', '55')).toBe(true);
  });

  it('un-favouriting persists too (does not survive remount)', () => {
    const first = renderHook(() => useFilterSelection([]));
    act(() => first.result.current.toggleFavourite('bus', '55'));
    act(() => first.result.current.toggleFavourite('bus', '55'));
    first.unmount();

    const second = renderHook(() => useFilterSelection([]));
    expect(second.result.current.isLineFavourite('bus', '55')).toBe(false);
  });

  it('a single toggle is persisted immediately (write-through)', () => {
    const { result } = renderHook(() => useFilterSelection([]));

    act(() => result.current.toggleFavourite('bus', '55'));

    const stored = JSON.parse(window.localStorage.getItem(FAVOURITES_STORAGE_KEY));
    expect(stored).toContainEqual({ mode: 'bus', line: '55' });
  });

  it('stores favourites as {mode, line} records, not colon-key strings', () => {
    const { result } = renderHook(() => useFilterSelection([]));

    act(() => result.current.toggleFavourite('bus', '55'));

    const stored = JSON.parse(window.localStorage.getItem(FAVOURITES_STORAGE_KEY));
    expect(Array.isArray(stored)).toBe(true);
    expect(stored.every(e => typeof e === 'object' && 'mode' in e && 'line' in e)).toBe(true);
  });

  it('throwing localStorage degrades silently without crashing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });

    const { result } = renderHook(() => useFilterSelection([v('v1', 'bus', '55')]));
    expect(() => act(() => result.current.toggleFavourite('bus', '55'))).not.toThrow();
    // in-session toggle still works; map keeps rendering vehicles
    expect(result.current.isLineFavourite('bus', '55')).toBe(true);
    expect(result.current.filteredVehicles).toHaveLength(1);
  });

  it('favourite is not remembered when storage write is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const first = renderHook(() => useFilterSelection([]));
    act(() => first.result.current.toggleFavourite('bus', '55'));
    first.unmount();

    vi.restoreAllMocks();
    const second = renderHook(() => useFilterSelection([]));
    expect(second.result.current.isLineFavourite('bus', '55')).toBe(false);
  });

  it.each([
    ['not-json',                                                  []],
    ['{"mode":"bus","line":"55"}',                                []],
    ['[{"mode":"bus","line":"55"},{"line":"3"}]',                 [{ mode: 'bus', line: '55' }]],
    ['[{"mode":"bus","line":"55"},{"mode":"bus","line":"55"}]',   [{ mode: 'bus', line: '55' }]],
  ])('malformed stored value %j restores %j', (stored, restored) => {
    window.localStorage.setItem(FAVOURITES_STORAGE_KEY, stored);
    const { result } = renderHook(() => useFilterSelection([]));

    expect(result.current.isLineFavourite('bus', '55')).toBe(restored.some(r => r.mode === 'bus' && r.line === '55'));
    expect(result.current.isLineFavourite('bus', '3')).toBe(false);
  });
});
