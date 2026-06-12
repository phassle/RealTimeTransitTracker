import { OPERATOR_MAP } from '../config/operators';
import './IncidentInbox.css';

function operatorName(slug) {
  return OPERATOR_MAP.get(slug)?.name ?? slug;
}

function formatStarted(startedAt) {
  return new Date(startedAt).toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Open Incidents sort above resolved ones so live problems never hide below
// stale ones (PRD story 3). Stable within each group to preserve clustering order.
function openFirst(incidents) {
  const rank = (i) => (i.status === 'resolved' ? 1 : 0);
  return incidents
    .map((inc, idx) => [inc, idx])
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1])
    .map(([inc]) => inc);
}

// Incident Inbox — lists Incidents only (never raw Anomalies). Each row shows
// the severity-relevant facts an operator prioritizes by: affected line(s),
// vehicle count and started-at time. Selecting a row focuses the map.
export function IncidentInbox({ incidents = [], selectedIncidentId = null, onSelect = () => {} }) {
  if (incidents.length === 0) {
    return (
      <div className="incident-inbox incident-inbox--empty" role="status">
        No incidents
      </div>
    );
  }

  return (
    <ul className="incident-inbox" role="list" aria-label="Incident inbox">
      {openFirst(incidents).map((inc) => {
        const count = inc.vehicleIds.length;
        const selected = inc.id === selectedIncidentId;
        const resolved = inc.status === 'resolved';
        // Operator-subject (feed outage) Incidents are data problems: no line or
        // vehicle-count facts, just the affected operator's feed.
        const isOutage = inc.subject.kind === 'operator';
        return (
          <li key={inc.id} className="incident-inbox__item">
            <button
              type="button"
              className={`incident-row${selected ? ' incident-row--selected' : ''}${
                resolved ? ' incident-row--resolved' : ''
              }${isOutage ? ' incident-row--outage' : ''}`}
              aria-pressed={selected}
              onClick={() => onSelect(inc.id)}
            >
              <span className="incident-row__line">
                {inc.demo && <span className="incident-row__demo">Demo</span>}
                {isOutage
                  ? `Feed outage · ${operatorName(inc.subject.operator)}`
                  : inc.lines.length > 0
                    ? `Line ${inc.lines.join(', ')}`
                    : 'Unknown line'}
                {resolved && (
                  <>
                    {' · '}
                    <span className="incident-row__status">Resolved</span>
                  </>
                )}
              </span>
              {isOutage ? (
                <span className="incident-row__count incident-row__count--data">Data problem</span>
              ) : (
                <span className="incident-row__count">
                  {count} {count === 1 ? 'vehicle' : 'vehicles'}
                </span>
              )}
              <time className="incident-row__started" dateTime={new Date(inc.startedAt).toISOString()}>
                {formatStarted(inc.startedAt)}
              </time>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
