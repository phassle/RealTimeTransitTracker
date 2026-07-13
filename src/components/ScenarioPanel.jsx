import { OPERATOR_MAP } from '../config/operators';
import './ScenarioPanel.css';

// ScenarioPanel — the Command Center's what-if blast-radius panel, sibling to
// IncidentDetail (PRD #143). A pure presenter over the structured scenario
// impact: it renders NO free text derived from the data, only formats the
// counts and labels the rules produced.
//
// Every surface reads as a hypothesis, never an observed fact — a Scenario
// invents its premise (an area declared closed that is NOT actually happening),
// so it must be unmistakably a simulation. Presets are demo content, labelled
// like Injected Incidents. Slice 1 (issue #144) shows the "in-area now"
// population only; service-intensity ranking is Slice 2.

function operatorLabel(operator) {
  return OPERATOR_MAP.get(operator)?.name ?? operator?.toUpperCase() ?? operator;
}

export function ScenarioPanel({ scenario = null, impact = null }) {
  if (!scenario) return null;

  const lines = impact?.lines ?? [];
  const operators = impact?.operators ?? [];
  const vehicleCount = impact?.inAreaVehicleIds?.length ?? 0;
  const isEmpty = lines.length === 0 && vehicleCount === 0;

  return (
    <div className="scenario-panel" aria-label="Scenario blast radius">
      {scenario.demo && (
        <header className="scenario-panel__demo" role="note">
          Preset scenario — demo content, not a real detection
        </header>
      )}
      <header className="scenario-panel__subject">
        <span className="scenario-panel__title">What-if: {scenario.name}</span>
        <span className="scenario-panel__hedge">
          Hypothesis — this area is not actually closed. The figures below are what
          <strong> would </strong> be caught inside it right now, computed from live positions.
        </span>
      </header>

      <section className="scenario-panel__impact" aria-label="Estimated blast radius">
        <h3 className="scenario-panel__heading">Estimated blast radius</h3>
        {isEmpty ? (
          <p className="scenario-panel__empty">
            No affected lines — 0 vehicles currently inside the closed area.
          </p>
        ) : (
          <>
            <dl className="scenario-panel__summary">
              <div>
                <dt>Operators</dt>
                <dd>{operators.map(operatorLabel).join(', ') || '—'}</dd>
              </div>
              <div>
                <dt>Vehicles inside</dt>
                <dd>{vehicleCount}</dd>
              </div>
            </dl>
            <ul className="scenario-panel__lines" role="list" aria-label="Affected lines">
              {lines.map((l) => (
                <li key={`${l.operator}:${l.line}`} className="scenario-panel__line">
                  <span className="scenario-panel__line-no">Line {l.line}</span>
                  <span className="scenario-panel__line-op">{operatorLabel(l.operator)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
