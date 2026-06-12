import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IncidentInbox } from './IncidentInbox';

function incident(overrides = {}) {
  return {
    id: 'stationary:sl:bus-1',
    status: 'open',
    subject: { kind: 'geographic', latitude: 59.3293, longitude: 18.0686 },
    lines: ['4'],
    vehicleIds: ['sl:bus-1'],
    startedAt: new Date('2026-06-12T08:42:00Z').getTime(),
    lastUpdate: new Date('2026-06-12T08:48:00Z').getTime(),
    anomalies: [{}],
    ...overrides,
  };
}

describe('IncidentInbox', () => {
  it('renders an empty state when there are no incidents', () => {
    render(<IncidentInbox incidents={[]} />);
    expect(screen.getByText('No incidents')).toBeDefined();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('shows one row per incident with line, vehicle count and started-at time', () => {
    render(<IncidentInbox incidents={[incident()]} />);

    const rows = screen.getAllByRole('button');
    expect(rows).toHaveLength(1);
    expect(screen.getByText('Line 4')).toBeDefined();
    expect(screen.getByText('1 vehicle')).toBeDefined();

    // started-at rendered as a <time> with a machine-readable timestamp
    const time = document.querySelector('time');
    expect(time).toBeTruthy();
    expect(time.getAttribute('dateTime')).toBe('2026-06-12T08:42:00.000Z');
  });

  it('pluralizes the vehicle count', () => {
    render(<IncidentInbox incidents={[incident({ vehicleIds: ['a', 'b'] })]} />);
    expect(screen.getByText('2 vehicles')).toBeDefined();
  });

  it('calls onSelect with the incident id when a row is clicked', () => {
    const onSelect = vi.fn();
    render(<IncidentInbox incidents={[incident()]} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith('stationary:sl:bus-1');
  });

  it('marks the selected row as pressed', () => {
    render(<IncidentInbox incidents={[incident()]} selectedIncidentId="stationary:sl:bus-1" />);
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true');
  });
});
