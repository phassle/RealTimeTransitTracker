import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ControlPanel } from './ControlPanel';

// The line filter is collapsed by default; expand it so the chips render.
function expandLineFilter() {
  fireEvent.click(screen.getByText('Filter by Line'));
}

const baseProps = {
  availableLines: { bus: [{ line: '55', count: 3 }] },
  enabledModes: ['bus'],
};

describe('ControlPanel — Vehicle stats', () => {
  it('memoizes mode counts across unrelated panel state renders', () => {
    const vehicles = [
      { mode: 'bus' },
      { mode: 'bus' },
      { mode: 'train' },
    ];
    const reduceSpy = vi.spyOn(vehicles, 'reduce');

    render(<ControlPanel {...baseProps} vehicles={vehicles} enabledModes={['bus', 'train']} />);

    expect(reduceSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Total vehicles:').nextSibling.textContent).toBe('3');
    expect(screen.getByText('(2)')).toBeTruthy();
    expect(screen.getByText('(1)')).toBeTruthy();

    fireEvent.click(screen.getByTitle('Collapse'));
    fireEvent.click(screen.getByTitle('Expand'));

    expect(reduceSpy).toHaveBeenCalledTimes(1);
  });
});

describe('ControlPanel — Favourite star control', () => {
  it('renders a star control on each available-line chip', () => {
    render(<ControlPanel {...baseProps} />);
    expandLineFilter();

    expect(screen.getByRole('button', { name: /favourite line 55/i })).toBeTruthy();
  });

  it('clicking the star invokes onFavouriteToggle for that line', () => {
    const onFavouriteToggle = vi.fn();
    render(<ControlPanel {...baseProps} onFavouriteToggle={onFavouriteToggle} />);
    expandLineFilter();

    fireEvent.click(screen.getByRole('button', { name: /favourite line 55/i }));

    expect(onFavouriteToggle).toHaveBeenCalledWith('bus', '55');
  });

  it('clicking the star does not toggle the line selection', () => {
    const onLineToggle = vi.fn();
    render(<ControlPanel {...baseProps} onLineToggle={onLineToggle} />);
    expandLineFilter();

    fireEvent.click(screen.getByRole('button', { name: /favourite line 55/i }));

    expect(onLineToggle).not.toHaveBeenCalled();
  });

  it('renders a favourited chip in a visually distinct (starred) state', () => {
    render(
      <ControlPanel
        {...baseProps}
        isLineFavourite={(mode, line) => mode === 'bus' && line === '55'}
      />,
    );
    expandLineFilter();

    const star = screen.getByRole('button', { name: /unfavourite line 55/i });
    expect(star).toBeTruthy();
    expect(star.getAttribute('aria-pressed')).toBe('true');
    // chip carries the favourite modifier class
    expect(star.closest('.line-chip').className).toMatch(/favourite/);
  });
});

describe('ControlPanel — Manage Favourites (summary-chip star, Clear favourites)', () => {
  // A seeded Favourite whose line has no live vehicle still appears as a
  // selected-summary chip but has no available-line chip. The summary chip
  // must carry its own star so it can be unfavourited.
  const summaryProps = {
    availableLines: {},
    enabledModes: ['bus'],
    selectedLines: [{ mode: 'bus', line: '55' }],
    isLineFavourite: (mode, line) => mode === 'bus' && line === '55',
  };

  it('renders a star control on each selected-summary chip', () => {
    render(<ControlPanel {...summaryProps} />);
    expandLineFilter();

    expect(screen.getByRole('button', { name: /unfavourite line 55/i })).toBeTruthy();
  });

  it('clicking the summary-chip star invokes onFavouriteToggle for that line', () => {
    const onFavouriteToggle = vi.fn();
    render(<ControlPanel {...summaryProps} onFavouriteToggle={onFavouriteToggle} />);
    expandLineFilter();

    fireEvent.click(screen.getByRole('button', { name: /unfavourite line 55/i }));

    expect(onFavouriteToggle).toHaveBeenCalledWith('bus', '55');
  });

  it('clicking the summary-chip star does not toggle the line selection', () => {
    const onLineToggle = vi.fn();
    render(<ControlPanel {...summaryProps} onLineToggle={onLineToggle} />);
    expandLineFilter();

    fireEvent.click(screen.getByRole('button', { name: /unfavourite line 55/i }));

    expect(onLineToggle).not.toHaveBeenCalled();
  });

  it('renders "Clear favourites" as a distinct control from "Clear all"', () => {
    render(<ControlPanel {...summaryProps} />);
    expandLineFilter();

    const clearAll = screen.getByRole('button', { name: /^clear all$/i });
    const clearFavourites = screen.getByRole('button', { name: /clear favourites/i });
    expect(clearAll).toBeTruthy();
    expect(clearFavourites).toBeTruthy();
    expect(clearAll).not.toBe(clearFavourites);
  });

  it('clicking "Clear favourites" invokes onClearFavourites, not onClearLines', () => {
    const onClearFavourites = vi.fn();
    const onClearLines = vi.fn();
    render(
      <ControlPanel
        {...summaryProps}
        onClearFavourites={onClearFavourites}
        onClearLines={onClearLines}
      />,
    );
    expandLineFilter();

    fireEvent.click(screen.getByRole('button', { name: /clear favourites/i }));

    expect(onClearFavourites).toHaveBeenCalledTimes(1);
    expect(onClearLines).not.toHaveBeenCalled();
  });
});
