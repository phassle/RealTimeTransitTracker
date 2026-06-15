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
