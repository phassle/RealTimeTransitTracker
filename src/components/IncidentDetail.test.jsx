import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { IncidentDetail } from './IncidentDetail';
import { anomalyKey } from '../services/incidentEvidence';

const MIN = 60 * 1000;
const T0 = new Date('2026-06-12T08:42:00Z').getTime();

function anomaly(overrides = {}) {
  return {
    ruleId: 'stationary-on-active-trip',
    vehicleId: 'sl:bus-1',
    operator: 'sl',
    line: '4',
    tripId: 'trip-abc',
    latitude: 59.3293,
    longitude: 18.0686,
    measuredStationaryMs: 6 * MIN,
    thresholdMs: 5 * MIN,
    displacementThresholdM: 30,
    startedAt: T0,
    detectedAt: T0 + 6 * MIN,
    ...overrides,
  };
}

function incident(anomalies) {
  return {
    id: 'stationary:sl:bus-1',
    status: 'open',
    subject: { kind: 'geographic', latitude: 59.3293, longitude: 18.0686 },
    lines: ['4'],
    vehicleIds: ['sl:bus-1'],
    startedAt: T0,
    lastUpdate: T0 + 6 * MIN,
    anomalies,
  };
}

describe('IncidentDetail', () => {
  it('shows a placeholder when no incident is selected', () => {
    render(<IncidentDetail incident={null} />);
    expect(screen.getByRole('status')).toBeDefined();
  });

  // Scenario: Evidence renders structured
  it('renders, for each contributing rule, the rule, threshold, measured value, affected vehicles/lines and start time', () => {
    render(<IncidentDetail incident={incident([anomaly()])} />);

    const panel = screen.getByLabelText('Why flagged?');
    const why = within(panel);
    expect(why.getByText('Stationary on active trip')).toBeDefined();
    // threshold + measured value
    expect(why.getByText('5 min')).toBeDefined();
    expect(why.getByText('6 min')).toBeDefined();
    // affected vehicle + line
    expect(why.getByText('sl:bus-1')).toBeDefined();
    expect(why.getByText('4')).toBeDefined();
    // when it started
    expect(why.getByText('08:42')).toBeDefined(); // sv-SE, UTC test env
  });

  // Scenario: The timeline is chronological
  it('lists the anomalies in time order with their evidence', () => {
    const a1 = anomaly({ detectedAt: T0 + 8 * MIN, measuredStationaryMs: 8 * MIN });
    const a2 = anomaly({ detectedAt: T0 + 6 * MIN, measuredStationaryMs: 6 * MIN });
    render(<IncidentDetail incident={incident([a1, a2])} />);

    const timeline = screen.getByLabelText('Incident timeline');
    const items = within(timeline).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    // earliest first
    expect(items[0].getAttribute('data-anomaly-key')).toBe(anomalyKey(a2));
    expect(items[1].getAttribute('data-anomaly-key')).toBe(anomalyKey(a1));
    // each carries its evidence (measured value)
    expect(within(items[0]).getByText('6 min')).toBeDefined();
    expect(within(items[1]).getByText('8 min')).toBeDefined();
  });

  // Scenario: Every claim traces to an Anomaly
  it('highlights the corresponding timeline anomaly when a claim is activated', () => {
    const a = anomaly();
    render(<IncidentDetail incident={incident([a])} />);

    const item = document.querySelector(`[data-anomaly-key="${anomalyKey(a)}"]`);
    expect(item.className).not.toContain('incident-timeline__item--highlighted');

    const claim = within(screen.getByLabelText('Why flagged?')).getByRole('button');
    fireEvent.click(claim);

    expect(item.className).toContain('incident-timeline__item--highlighted');
    expect(item.getAttribute('aria-current')).toBe('true');
  });

  it('has no orphan claims — every claim button maps to a rendered timeline anomaly', () => {
    const a1 = anomaly({ detectedAt: T0 + 6 * MIN });
    const a2 = anomaly({ detectedAt: T0 + 8 * MIN });
    render(<IncidentDetail incident={incident([a1, a2])} />);

    const claims = within(screen.getByLabelText('Why flagged?')).getAllByRole('button');
    for (const claim of claims) {
      fireEvent.click(claim);
      // activating any claim must highlight exactly one timeline entry
      const highlighted = document.querySelectorAll('.incident-timeline__item--highlighted');
      expect(highlighted).toHaveLength(1);
    }
  });
});
