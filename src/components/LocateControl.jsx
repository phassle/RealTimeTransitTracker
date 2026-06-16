import './LocateControl.css';

// "Locate me" map control, bottom-right (top-left = ControlPanel, top-right =
// zoom + view toggle). A thin presenter: it derives everything from the
// useGeolocation status and holds no geolocation logic of its own.
//
// Enabled state and tooltip are a pure mapping from status (issue #113). The two
// non-success terminal states are kept distinct: denied (the user refused) and
// unavailable (no capability — insecure origin / no API) get separate tooltips
// so refusal is never conflated with absent capability.
//
// In-progress feedback (issue #114, story 9): while status === 'locating' the
// button is aria-busy and carries the --busy modifier (a spinning glyph), so a
// tap visibly registers. It clears the moment status leaves locating — success,
// denied, timeout, or unavailable all return the button to its resting state.
const TOOLTIP = {
  idle: 'Locate me',
  locating: 'Locate me',
  success: 'Locate me',
  denied: 'you declined location access',
  unavailable: 'location is unavailable in this context',
};

const DISABLED = new Set(['locating', 'denied', 'unavailable']);

export function LocateControl({ status = 'idle', onLocate }) {
  const locating = status === 'locating';
  const disabled = DISABLED.has(status);
  const title = TOOLTIP[status] ?? TOOLTIP.idle;

  return (
    <button
      type="button"
      className={locating ? 'locate-control locate-control--busy' : 'locate-control'}
      onClick={onLocate}
      disabled={disabled}
      aria-label="Locate me"
      aria-busy={locating}
      title={title}
    >
      {locating ? '…' : '◎'}
    </button>
  );
}
