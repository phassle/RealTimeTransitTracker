import { OPERATOR_MAP } from '../config/operators';
import './IncidentInbox.css';

function operatorName(slug) {
  return OPERATOR_MAP.get(slug)?.name ?? slug;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('sv-SE', {
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
// vehicle count, started-at and last-update times (PRD #84 story 2).
// Selecting a row focuses the map.
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
        // Stale: the source operator's feed has gone blind, so this Incident is
        // frozen and never auto-resolves (PRD #84 story 14). Flagged so the
        // operator knows the picture is no longer live, not that it cleared.
        const stale = Boolean(inc.stale);
        return (
          <li key={inc.id} className="incident-inbox__item">
            <button
              type="button"
              className={`incident-row${selected ? ' incident-row--selected' : ''}${
                resolved ? ' incident-row--resolved' : ''
              }${isOutage ? ' incident-row--outage' : ''}${stale ? ' incident-row--stale' : ''}`}
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
                {stale && (
                  <>
                    {' · '}
                    <span className="incident-row__stale" title="Source feed is blind — frozen, not resolved">
                      Stale
                    </span>
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
              <span className="incident-row__times">
                <time className="incident-row__started" dateTime={new Date(inc.startedAt).toISOString()}>
                  {formatTime(inc.startedAt)}
                </time>
                {inc.lastUpdate != null && (
                  <time
                    className="incident-row__updated"
                    dateTime={new Date(inc.lastUpdate).toISOString()}
                    title="Last update"
                  >
                    upd. {formatTime(inc.lastUpdate)}
                  </time>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
