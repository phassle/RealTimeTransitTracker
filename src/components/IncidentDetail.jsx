import { useState } from 'react';
import {
  aggregateEvidence,
  timelineAnomalies,
  anomalyEvidence,
} from '../services/incidentEvidence';
import './IncidentDetail.css';

// Incident detail — the right-hand panel of the Command Center. Two parts, both
// pure presenters over the Incident's structured Anomaly evidence (PRD #84
// stories 16–18):
//
//  - "Why flagged?" — one claim per contributing rule (rule, threshold,
//    measured value, affected vehicles/lines, start time). No free text, no LLM.
//  - Timeline — the Incident's Anomalies in chronological order with evidence.
//
// Every claim traces to an Anomaly: activating a claim highlights the
// corresponding Anomaly on the timeline, so the analyst can audit the
// reasoning. There are no orphan claims — each references a real timeline entry.

function formatTime(t) {
  if (t == null) return '';
  return new Date(t).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

function joinOrDash(values) {
  return values.length > 0 ? values.join(', ') : '—';
}

export function IncidentDetail({ incident = null }) {
  const [highlightedKey, setHighlightedKey] = useState(null);

  if (!incident) {
    return (
      <div className="incident-detail incident-detail--empty" role="status">
        Select an incident to see why it was flagged
      </div>
    );
  }

  const claims = aggregateEvidence(incident);
  const timeline = timelineAnomalies(incident);

  return (
    <div className="incident-detail">
      <section className="incident-detail__why" aria-label="Why flagged?">
        <h3 className="incident-detail__heading">Why flagged?</h3>
        <ul className="why-flagged" role="list">
          {claims.map((claim) => (
            <li key={claim.ruleId} className="why-flagged__item">
              <button
                type="button"
                className="why-flagged__claim"
                onClick={() => setHighlightedKey(claim.anomalyKey)}
              >
                <span className="why-flagged__rule">{claim.ruleLabel}</span>
                <dl className="why-flagged__evidence">
                  <div>
                    <dt>Threshold</dt>
                    <dd>{claim.threshold ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Measured</dt>
                    <dd>{claim.measured ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Vehicles</dt>
                    <dd>{joinOrDash(claim.vehicles)}</dd>
                  </div>
                  <div>
                    <dt>Lines</dt>
                    <dd>{joinOrDash(claim.lines)}</dd>
                  </div>
                  <div>
                    <dt>Since</dt>
                    <dd>{formatTime(claim.startedAt)}</dd>
                  </div>
                </dl>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="incident-detail__timeline" aria-label="Incident timeline">
        <h3 className="incident-detail__heading">Timeline</h3>
        <ol className="incident-timeline" role="list">
          {timeline.map((a) => {
            const ev = anomalyEvidence(a);
            const highlighted = ev.key === highlightedKey;
            return (
              <li
                key={ev.key}
                data-anomaly-key={ev.key}
                className={`incident-timeline__item${highlighted ? ' incident-timeline__item--highlighted' : ''}`}
                aria-current={highlighted ? 'true' : undefined}
              >
                <time
                  className="incident-timeline__time"
                  dateTime={ev.detectedAt != null ? new Date(ev.detectedAt).toISOString() : undefined}
                >
                  {formatTime(ev.detectedAt)}
                </time>
                <span className="incident-timeline__rule">{ev.ruleLabel}</span>
                {ev.measured != null && (
                  <span className="incident-timeline__measured">{ev.measured}</span>
                )}
                <span className="incident-timeline__vehicle">
                  {ev.vehicleId}
                  {ev.line ? ` · Line ${ev.line}` : ''}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
