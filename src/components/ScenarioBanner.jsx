import './ScenarioBanner.css';

// ScenarioBanner — a persistent "scenario active" indicator with a one-click
// exit (PRD #143, stories 12/13). Same prominence rule as ReplayControls'
// past-mode indicator (orange halo, role="status"): a non-live mode must be
// unmistakable so the operator never mistakes a what-if simulation for live
// reality. Exiting retracts the scenario completely and restores the live view.
export function ScenarioBanner({ scenario = null, onExit }) {
  if (!scenario) return null;

  return (
    <div className="scenario-banner" role="status" aria-label="Scenario active">
      <span className="scenario-banner__badge">◆ Scenario — what-if</span>
      <span className="scenario-banner__name">{scenario.name}</span>
      <button
        type="button"
        className="scenario-banner__exit"
        onClick={onExit}
      >
        Exit scenario
      </button>
    </div>
  );
}
