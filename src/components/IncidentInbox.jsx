import './IncidentInbox.css';

function formatStarted(startedAt) {
  return new Date(startedAt).toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
  });
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
      {incidents.map((inc) => {
        const count = inc.vehicleIds.length;
        const selected = inc.id === selectedIncidentId;
        return (
          <li key={inc.id} className="incident-inbox__item">
            <button
              type="button"
              className={`incident-row${selected ? ' incident-row--selected' : ''}`}
              aria-pressed={selected}
              onClick={() => onSelect(inc.id)}
            >
              <span className="incident-row__line">
                {inc.lines.length > 0 ? `Line ${inc.lines.join(', ')}` : 'Unknown line'}
              </span>
              <span className="incident-row__count">
                {count} {count === 1 ? 'vehicle' : 'vehicles'}
              </span>
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
