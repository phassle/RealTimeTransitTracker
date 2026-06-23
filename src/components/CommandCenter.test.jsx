import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { CommandCenter } from './CommandCenter';

const MIN = 60 * 1000;

// Fresh array each poll so useIncidents' effect re-runs.
function stuck() {
  return [
    { id: 'sl:bus-1', operator: 'sl', line: '4', tripId: 'trip-abc', latitude: 59.3293, longitude: 18.0686 },
  ];
}

function movingAt(lng) {
  return [{ id: 'sl:bus-1', operator: 'sl', line: '4', tripId: 'trip-abc', latitude: 59.3, longitude: lng }];
}

// Records the props it last received so the test can assert the focus wiring
// without a real Leaflet map.
function makeFakeMap() {
  const props = { last: null };
  const FakeMap = (p) => {
    props.last = p;
    return <div data-testid="fake-map" />;
  };
  return { FakeMap, props };
}

describe('CommandCenter', () => {
  it('renders the inbox and the map side by side', () => {
    const { FakeMap } = makeFakeMap();
    render(<CommandCenter vehicles={stuck()} MapComponent={FakeMap} now={() => 0} />);
    expect(screen.getByText('Incidents')).toBeDefined();
    expect(screen.getByTestId('fake-map')).toBeDefined();
  });

  it('selecting an Incident focuses the map on its subject and highlights its vehicles', () => {
    const { FakeMap, props } = makeFakeMap();
    let t = 0;
    const now = () => t;

    const { rerender } = render(
      <CommandCenter vehicles={stuck()} MapComponent={FakeMap} now={now} />,
    );

    // Advance past the stationary threshold so an Incident is raised.
    act(() => { t = 6 * MIN; });
    rerender(<CommandCenter vehicles={stuck()} MapComponent={FakeMap} now={now} />);

    // Before selection: map is not yet focused on the incident.
    expect(props.last.highlightedVehicleIds).toEqual([]);

    // Select the incident row.
    fireEvent.click(screen.getByRole('button', { name: /Line 4/ }));

    expect(props.last.center).toEqual([59.3293, 18.0686]);
    expect(props.last.highlightedVehicleIds).toEqual(['sl:bus-1']);
  });

  describe('downstream accent on the map (PRD #136)', () => {
    // A stalled bus plus a same-line+direction downstream bus near enough to be
    // forecast as degrading. The downstream bus keeps moving (it is approaching,
    // not stalled) so it forms no Incident of its own — leaving exactly one
    // "Line 4" row to select. `poll` shifts its position so it never trips the
    // stationary rule. Mirrors the useIncidents projection fixture.
    const stalledPlusDownstream = (stalledLng = 18.0686, poll = 0) => [
      { id: 'sl:bus-1', operator: 'sl', line: '4', direction: '0', tripId: 'trip-abc', latitude: 59.3293, longitude: stalledLng },
      { id: 'sl:bus-2', operator: 'sl', line: '4', direction: '0', tripId: 'trip-def', latitude: 59.31, longitude: 18.06 + poll * 0.001 },
    ];

    it('accents the selected geographic Incident\'s downstream (forecast) vehicles, distinct from the highlight', () => {
      const { FakeMap, props } = makeFakeMap();
      let t = 0;
      const now = () => t;

      const { rerender } = render(
        <CommandCenter vehicles={stalledPlusDownstream(18.0686, 0)} MapComponent={FakeMap} now={now} />,
      );
      act(() => { t = 6 * MIN; });
      rerender(<CommandCenter vehicles={stalledPlusDownstream(18.0686, 1)} MapComponent={FakeMap} now={now} />);

      // No selection yet ⇒ no forecast accent.
      expect(props.last.predictedVehicleIds).toEqual([]);

      fireEvent.click(screen.getByRole('button', { name: /Line 4/ }));

      // The Downstream vehicle is accented, and the accent channel is separate
      // from the selection/highlight channel (the stalled bus is highlighted,
      // the downstream bus is predicted — never the same id in both).
      expect(props.last.predictedVehicleIds).toContain('sl:bus-2');
      expect(props.last.predictedVehicleIds).not.toContain('sl:bus-1');
      expect(props.last.highlightedVehicleIds).toContain('sl:bus-1');
    });

    it('shows no downstream accent when the projection retracts between polls', () => {
      const { FakeMap, props } = makeFakeMap();
      let t = 0;
      const now = () => t;

      const { rerender } = render(
        <CommandCenter vehicles={stalledPlusDownstream(18.0686, 0)} MapComponent={FakeMap} now={now} />,
      );
      act(() => { t = 6 * MIN; });
      rerender(<CommandCenter vehicles={stalledPlusDownstream(18.0686, 1)} MapComponent={FakeMap} now={now} />);
      fireEvent.click(screen.getByRole('button', { name: /Line 4/ }));
      expect(props.last.predictedVehicleIds).toContain('sl:bus-2');

      // Next poll: the stalled bus has driven away — the projection retracts.
      act(() => { t = 7 * MIN; });
      rerender(<CommandCenter vehicles={stalledPlusDownstream(18.2, 2)} MapComponent={FakeMap} now={now} />);

      expect(props.last.predictedVehicleIds).toEqual([]);
    });

    it('shows no downstream accent for an operator-subject (feed outage) Incident', () => {
      const { FakeMap, props } = makeFakeMap();
      let t = 0;
      const now = () => t;
      const failFeeds = () => [{ operator: 'sl', ok: false, vehicleCount: 0, dataTimestamp: null }];

      const { rerender } = render(
        <CommandCenter vehicles={[]} feeds={failFeeds()} MapComponent={FakeMap} now={now} />,
      );
      for (let i = 1; i <= 3; i++) {
        act(() => { t = i * MIN; });
        rerender(<CommandCenter vehicles={[]} feeds={failFeeds()} MapComponent={FakeMap} now={now} />);
      }

      fireEvent.click(screen.getByRole('button', { name: /Feed outage · SL/ }));

      expect(props.last.predictedVehicleIds).toEqual([]);
    });
  });

  it('shows the selected Incident\'s why-flagged panel and timeline', () => {
    const { FakeMap } = makeFakeMap();
    let t = 0;
    const now = () => t;

    const { rerender } = render(
      <CommandCenter vehicles={stuck()} MapComponent={FakeMap} now={now} />,
    );
    act(() => { t = 6 * MIN; });
    rerender(<CommandCenter vehicles={stuck()} MapComponent={FakeMap} now={now} />);

    // Before selection: no detail rendered, just the placeholder.
    expect(screen.getByText(/Select an incident/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /Line 4/ }));

    const detail = screen.getByLabelText('Incident detail');
    expect(detail).toBeDefined();
    expect(screen.getByLabelText('Why flagged?')).toBeDefined();
    expect(screen.getByLabelText('Incident timeline')).toBeDefined();
    expect(screen.getAllByText('Stationary on active trip').length).toBeGreaterThan(0);
  });

  it('raises a Feed outage Incident from repeated fetch failures and shows feed status', () => {
    const { FakeMap } = makeFakeMap();
    let t = 0;
    const now = () => t;
    const okFeeds = () => [{ operator: 'sl', ok: true, vehicleCount: 50, dataTimestamp: 1000 }];
    const failFeeds = () => [{ operator: 'sl', ok: false, vehicleCount: 0, dataTimestamp: null }];

    const { rerender } = render(
      <CommandCenter vehicles={[]} feeds={okFeeds()} MapComponent={FakeMap} now={now} />,
    );
    for (let i = 1; i <= 3; i++) {
      act(() => { t = i * MIN; });
      rerender(<CommandCenter vehicles={[]} feeds={failFeeds()} MapComponent={FakeMap} now={now} />);
    }

    // A Feed outage Incident appears in the inbox as a data problem.
    expect(screen.getByText(/Feed outage · SL/)).toBeDefined();

    // Feed status panel reads SL as a watched feed and an unwatched region as "not watched".
    const statusPanel = screen.getByLabelText('Feed status');
    expect(within(statusPanel).getByText('SL')).toBeDefined();
    expect(within(statusPanel).getAllByText(/not watched/i).length).toBeGreaterThan(0);
  });

  it('lists nearby webcams for the selected Incident and records a Verification on its timeline', () => {
    const { FakeMap } = makeFakeMap();
    let t = 0;
    const now = () => t;

    // A traffic camera near the stuck bus (59.3293, 18.0686).
    const cameras = [
      {
        id: 'trafikverket:1', name: 'E4 Norrtull', type: 'traffic', media: 'image',
        lat: 59.335, lon: 18.07, imageUrl: 'https://cam.example.com/e4.jpg',
        pageUrl: 'https://cam.example.com/e4', source: 'trafikverket', attribution: 'Trafikverket',
      },
    ];

    const { rerender } = render(
      <CommandCenter vehicles={stuck()} MapComponent={FakeMap} now={now} cameras={cameras} />,
    );
    act(() => { t = 6 * MIN; });
    rerender(<CommandCenter vehicles={stuck()} MapComponent={FakeMap} now={now} cameras={cameras} />);

    fireEvent.click(screen.getByRole('button', { name: /Line 4/ }));

    // Nearby webcam appears in the detail panel.
    const webcamSection = screen.getByLabelText('Nearby webcams');
    expect(within(webcamSection).getByText('E4 Norrtull')).toBeDefined();

    // Mark it as a Verification; it lands on the timeline naming the webcam.
    act(() => { t = 7 * MIN; });
    fireEvent.click(within(webcamSection).getByRole('button', { name: /mark as verification/i }));

    const timeline = screen.getByLabelText('Incident timeline');
    expect(within(timeline).getByText(/Verified via E4 Norrtull/)).toBeDefined();
  });

  describe('injected (demo) incidents', () => {
    // A traffic camera near the demo scene (central Stockholm) so the nearby-
    // webcam panel has content when the injected incident is selected.
    const demoCameras = [
      {
        id: 'trafikverket:demo', name: 'Sergels torg', type: 'traffic', media: 'image',
        lat: 59.3326, lon: 18.0649, imageUrl: 'https://cam.example.com/s.jpg',
        pageUrl: 'https://cam.example.com/s', source: 'trafikverket', attribution: 'Trafikverket',
      },
    ];

    it('activating the demo control raises an Injected Incident through the real pipeline', () => {
      const { FakeMap } = makeFakeMap();
      render(<CommandCenter vehicles={[]} MapComponent={FakeMap} now={() => 0} cameras={demoCameras} />);

      // No incidents until the presenter injects one.
      expect(screen.getByText('No incidents')).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: /inject demo/i }));

      // It appears in the inbox, labelled as demo content.
      expect(screen.getByText('Demo')).toBeDefined();

      // Selecting it shows evidence, timeline and nearby webcams like any Incident.
      fireEvent.click(screen.getByRole('button', { name: /Line/ }));
      expect(screen.getByLabelText('Why flagged?')).toBeDefined();
      expect(screen.getByLabelText('Incident timeline')).toBeDefined();
      const webcamSection = screen.getByLabelText('Nearby webcams');
      expect(within(webcamSection).getByText('Sergels torg')).toBeDefined();
    });

    it('labels the injected incident as demo on the map once it is focused', () => {
      const { FakeMap } = makeFakeMap();
      render(<CommandCenter vehicles={[]} MapComponent={FakeMap} now={() => 0} cameras={demoCameras} />);
      fireEvent.click(screen.getByRole('button', { name: /inject demo/i }));

      const mapRegion = screen.getByLabelText('Map');
      // Not labelled until the demo incident is selected/focused.
      expect(within(mapRegion).queryByText(/demo/i)).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: /Line/ }));
      expect(within(mapRegion).getByText(/demo/i)).toBeDefined();
    });
  });

  it('exposes recording export/import controls over the map', () => {
    const { FakeMap } = makeFakeMap();
    render(<CommandCenter vehicles={movingAt(18.0)} MapComponent={FakeMap} now={() => 0} />);
    expect(screen.getByRole('button', { name: /export recording/i })).toBeDefined();
    expect(screen.getByLabelText(/import recording/i)).toBeDefined();
  });

  it('scrubbing renders past positions and shows the past-mode indicator', () => {
    const { FakeMap, props } = makeFakeMap();
    let t = 0;
    const now = () => t;

    const { rerender } = render(
      <CommandCenter vehicles={movingAt(18.0)} MapComponent={FakeMap} now={now} />,
    );
    act(() => { t = 2 * 60 * 1000; });
    rerender(<CommandCenter vehicles={movingAt(19.0)} MapComponent={FakeMap} now={now} />);

    // Live: map renders current positions, no past indicator.
    expect(props.last.vehicles).toEqual(movingAt(19.0));
    expect(screen.queryByText(/viewing the past/i)).toBeNull();

    // Scrub to the start of the session.
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0' } });

    // Map now renders the past snapshot; an unmistakable past indicator shows.
    expect(props.last.vehicles).toEqual(movingAt(18.0));
    expect(screen.getByText(/viewing the past/i)).toBeDefined();

    // One click returns to live.
    fireEvent.click(screen.getByRole('button', { name: /return to live/i }));
    expect(props.last.vehicles).toEqual(movingAt(19.0));
    expect(screen.queryByText(/viewing the past/i)).toBeNull();
  });
});
