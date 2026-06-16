import './LocateControl.css';

// "Locate me" map control, bottom-right (top-left = ControlPanel, top-right =
// zoom + view toggle). A thin presenter: it derives everything from the
// useGeolocation status and holds no geolocation logic of its own.
//
// This slice (issue #112) covers idle → locating → success. The button shows a
// pending state while locating and is otherwise tappable. denied/unavailable
// tooltips and disabling land in a later slice.
export function LocateControl({ status = 'idle', onLocate }) {
  const locating = status === 'locating';

  return (
    <button
      type="button"
      className="locate-control"
      onClick={onLocate}
      disabled={locating}
      aria-label="Locate me"
      aria-busy={locating}
      title="Locate me"
    >
      {locating ? '…' : '◎'}
    </button>
  );
}
