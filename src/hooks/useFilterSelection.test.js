import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFilterSelection } from './useFilterSelection';

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
