import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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
