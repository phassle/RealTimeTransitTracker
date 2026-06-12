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
  it('flags a stale incident in its row and only the stale one', () => {
    render(
      <IncidentInbox
        incidents={[incident({ id: 's1', stale: true }), incident({ id: 's2', stale: false })]}
      />,
    );
    expect(screen.getAllByText('Stale')).toHaveLength(1);
  });

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

  it('orders open incidents above resolved ones regardless of input order', () => {
    const resolved = incident({ id: 'r', status: 'resolved', lines: ['9'], vehicleIds: ['r1'] });
    const open = incident({ id: 'o', status: 'open', lines: ['4'], vehicleIds: ['o1'] });
    render(<IncidentInbox incidents={[resolved, open]} />);

    const rows = screen.getAllByRole('button');
    expect(rows).toHaveLength(2);
    // open ('Line 4') first, resolved ('Line 9') second
    expect(rows[0].textContent).toContain('Line 4');
    expect(rows[1].textContent).toContain('Line 9');
  });

  it('renders an operator-subject (feed outage) incident as a data problem, not a line/vehicle row', () => {
    const outage = incident({
      id: 'feed-outage:sl:0',
      subject: { kind: 'operator', operator: 'sl' },
      lines: [],
      vehicleIds: [],
    });
    render(<IncidentInbox incidents={[outage]} />);

    expect(screen.getByText(/Feed outage/)).toBeDefined();
    expect(screen.getByText(/SL/)).toBeDefined(); // operator name
    // no traffic facts: it has no lines or vehicle count
    expect(screen.queryByText(/vehicle/)).toBeNull();
    expect(screen.queryByText(/Line/)).toBeNull();
  });

  it('labels an injected (demo) incident as demo content in the inbox', () => {
    const demo = incident({ id: 'demo:1', demo: true });
    render(<IncidentInbox incidents={[demo]} />);
    expect(screen.getByText('Demo')).toBeDefined();
  });

  it('does not label a real incident as demo', () => {
    render(<IncidentInbox incidents={[incident()]} />);
    expect(screen.queryByText('Demo')).toBeNull();
  });

  it('marks resolved rows so they read as inactive', () => {
    const resolved = incident({ id: 'r', status: 'resolved' });
    render(<IncidentInbox incidents={[resolved]} />);
    const row = screen.getByRole('button');
    expect(row.className).toContain('incident-row--resolved');
    expect(screen.getByText('Resolved')).toBeDefined();
  });
});
