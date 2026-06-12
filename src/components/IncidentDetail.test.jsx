import { describe, it, expect } from 'vitest';
import { useState } from 'react';
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

  it('presents an operator-subject (feed outage) incident as a data problem', () => {
    const outageAnomaly = {
      ruleId: 'feed-fetch-failure',
      subjectKind: 'operator',
      operator: 'sl',
      measuredFailures: 3,
      thresholdFailures: 3,
      startedAt: T0,
      detectedAt: T0 + 6 * MIN,
    };
    const outage = {
      id: 'feed-outage:sl:0',
      status: 'open',
      subject: { kind: 'operator', operator: 'sl' },
      lines: [],
      vehicleIds: [],
      startedAt: T0,
      lastUpdate: T0 + 6 * MIN,
      anomalies: [outageAnomaly],
    };
    render(<IncidentDetail incident={outage} />);
    expect(screen.getByText(/Feed outage/)).toBeDefined();
    expect(screen.getByText(/SL/)).toBeDefined();
    expect(screen.getByText(/data problem/i)).toBeDefined();
    expect(screen.getAllByText('Feed fetch failures').length).toBeGreaterThan(0);
  });

  describe('injected (demo) incident labelling', () => {
    it('shows a demo banner on the detail panel', () => {
      render(<IncidentDetail incident={{ ...incident([anomaly()]), demo: true }} />);
      expect(screen.getByText(/injected demo/i)).toBeDefined();
    });

    it('labels the timeline as demo content', () => {
      render(<IncidentDetail incident={{ ...incident([anomaly()]), demo: true }} />);
      const timeline = screen.getByLabelText('Incident timeline');
      expect(within(timeline).getByText(/demo/i)).toBeDefined();
    });

    it('does not label a real incident as demo', () => {
      render(<IncidentDetail incident={incident([anomaly()])} />);
      expect(screen.queryByText(/injected demo/i)).toBeNull();
      const timeline = screen.getByLabelText('Incident timeline');
      expect(within(timeline).queryByText(/demo/i)).toBeNull();
    });
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

function imageCam(overrides = {}) {
  return {
    id: 'trafikverket:1',
    name: 'E4 Norrtull',
    type: 'traffic',
    media: 'image',
    lat: 59.35,
    lon: 18.05,
    imageUrl: 'https://cam.example.com/e4.jpg',
    pageUrl: 'https://cam.example.com/e4',
    source: 'trafikverket',
    attribution: 'Trafikverket',
    distanceM: 800,
    ...overrides,
  };
}

function linkoutCam(overrides = {}) {
  return {
    id: 'windy:99',
    name: 'Slussen view',
    type: 'weather',
    media: 'linkout',
    lat: 59.32,
    lon: 18.07,
    imageUrl: null,
    pageUrl: 'https://windy.com/webcam/99',
    source: 'windy',
    attribution: 'Windy.com',
    distanceM: 1500,
    ...overrides,
  };
}

describe('IncidentDetail — nearby webcams + Verification', () => {
  // Scenario: Nearest webcams are listed traffic-first with inline stills
  it('lists the nearby webcams (already ranked) and shows an inline still for image-capable ones', () => {
    const webcams = [imageCam(), linkoutCam()];
    render(<IncidentDetail incident={incident([anomaly()])} webcams={webcams} />);

    const section = screen.getByLabelText('Nearby webcams');
    const items = within(section).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    // Order preserved from the (pre-ranked) input: traffic first.
    expect(within(items[0]).getByText('E4 Norrtull')).toBeDefined();

    // Image-capable webcam renders an inline hotlinked still.
    const img = within(items[0]).getByRole('img');
    expect(img.getAttribute('src')).toBe('https://cam.example.com/e4.jpg');
  });

  // Scenario: Linkout webcams never embed
  it('renders a linkout webcam as name + attribution + link, never an embed', () => {
    render(<IncidentDetail incident={incident([anomaly()])} webcams={[linkoutCam()]} />);

    const section = screen.getByLabelText('Nearby webcams');
    expect(within(section).getByText('Slussen view')).toBeDefined();
    expect(within(section).getByText(/Windy\.com/)).toBeDefined();
    const link = within(section).getByRole('link');
    expect(link.getAttribute('href')).toBe('https://windy.com/webcam/99');
    // No embeds, no inline image for a linkout camera.
    expect(section.querySelector('iframe')).toBeNull();
    expect(section.querySelector('img')).toBeNull();
  });

  // Scenario: No webcams within the bound
  it('shows a clear empty state when there are no nearby webcams', () => {
    render(<IncidentDetail incident={incident([anomaly()])} webcams={[]} />);
    const section = screen.getByLabelText('Nearby webcams');
    expect(within(section).getByText(/no webcams/i)).toBeDefined();
    expect(within(section).queryAllByRole('listitem')).toHaveLength(0);
  });

  // Scenario: Marking a Verification lands on the timeline
  it('marking a webcam as a Verification adds a timeline entry naming that webcam', () => {
    // Stateful wrapper: marking a Verification appends it to the incident, just
    // as the hook does in the running app.
    function Harness() {
      const [verifications, setVerifications] = useState([]);
      const base = incident([anomaly()]);
      return (
        <IncidentDetail
          incident={{ ...base, verifications }}
          webcams={[imageCam()]}
          onVerify={(cam) =>
            setVerifications((v) => [...v, { webcamId: cam.id, webcamName: cam.name, verifiedAt: T0 + 10 * MIN }])
          }
        />
      );
    }
    render(<Harness />);

    // No verification on the timeline yet.
    const timeline = screen.getByLabelText('Incident timeline');
    expect(within(timeline).queryByText(/Verified/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /mark as verification/i }));

    const entry = within(timeline).getByText(/Verified/);
    expect(entry).toBeDefined();
    expect(within(timeline).getByText(/E4 Norrtull/)).toBeDefined();
  });
});
