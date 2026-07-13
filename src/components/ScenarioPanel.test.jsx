import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ScenarioPanel } from './ScenarioPanel';

const slussen = (overrides = {}) => ({
  id: 'scenario:preset:1',
  name: 'close Slussen',
  source: 'preset',
  demo: true,
  area: { south: 59.317, west: 18.065, north: 59.323, east: 18.078 },
  ...overrides,
});

describe('ScenarioPanel', () => {
  it('renders nothing when no scenario is active', () => {
    const { container } = render(<ScenarioPanel scenario={null} impact={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('lists the affected lines, operator, and vehicle count of the blast radius', () => {
    const impact = {
      lines: [
        { line: '2', operator: 'sl' },
        { line: '4', operator: 'sl' },
      ],
      operators: ['sl'],
      inAreaVehicleIds: ['sl:bus-1', 'sl:bus-2', 'sl:bus-3'],
    };
    render(<ScenarioPanel scenario={slussen()} impact={impact} />);

    const lines = screen.getByRole('list', { name: /affected lines/i });
    expect(within(lines).getByText(/Line 2/)).toBeDefined();
    expect(within(lines).getByText(/Line 4/)).toBeDefined();

    // Operator SL and the vehicle count (3) both surfaced.
    expect(screen.getAllByText(/SL/).length).toBeGreaterThan(0);
    expect(screen.getByText('3')).toBeDefined();
  });

  it('is worded as a hypothesis (what-if), never as an observed fact', () => {
    const impact = { lines: [{ line: '2', operator: 'sl' }], operators: ['sl'], inAreaVehicleIds: ['sl:bus-1'] };
    const { container } = render(<ScenarioPanel scenario={slussen()} impact={impact} />);
    expect(container.textContent).toMatch(/what-if|hypothesis|would/i);
  });

  it('labels a preset as demo content', () => {
    const impact = { lines: [], operators: [], inAreaVehicleIds: [] };
    const { container } = render(<ScenarioPanel scenario={slussen({ demo: true })} impact={impact} />);
    expect(container.textContent).toMatch(/demo/i);
  });

  it('reports zero affected lines and zero vehicles for an empty impact without error', () => {
    const impact = { lines: [], operators: [], inAreaVehicleIds: [] };
    const { container } = render(<ScenarioPanel scenario={slussen()} impact={impact} />);
    // Panel still renders (banner/panel stay), reporting nothing affected.
    expect(container.firstChild).not.toBeNull();
    expect(container.textContent).toMatch(/no affected lines|0 vehicle|zero/i);
  });
});
