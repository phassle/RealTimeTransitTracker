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
});
