import { useState } from 'react';
import {
  aggregateEvidence,
  timelineAnomalies,
  anomalyEvidence,
} from '../services/incidentEvidence';
import { OPERATOR_MAP } from '../config/operators';
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

// Webcam list item. Image-capable cameras show their current still inline
// (hotlinked; React escapes all attributes — ADR 0004). Linkout cameras show
// only name + attribution + a link to the source: never an iframe or embed.
function WebcamItem({ camera, onVerify }) {
  const isImage = camera.media === 'image' && camera.imageUrl;
  return (
    <li className="incident-webcams__item">
      {isImage && (
        <img
          className="incident-webcams__still"
          src={camera.imageUrl}
          alt={`Webcam: ${camera.name}`}
          loading="lazy"
        />
      )}
      <div className="incident-webcams__meta">
        <span className="incident-webcams__name">{camera.name}</span>
        <a
          className="incident-webcams__source"
          href={camera.pageUrl || camera.imageUrl || ''}
          target="_blank"
          rel="noopener noreferrer"
        >
          {camera.attribution || 'Source'} ↗
        </a>
      </div>
      {onVerify && (
        <button
          type="button"
          className="incident-webcams__verify"
          onClick={() => onVerify(camera)}
        >
          Mark as verification
        </button>
      )}
    </li>
  );
}

export function IncidentDetail({ incident = null, webcams = [], onVerify = null }) {
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
  const isOutage = incident.subject.kind === 'operator';
  const verifications = incident.verifications ?? [];

  // Merge Anomalies and Verifications into one chronological timeline so a
  // human-confirmed Verification is distinguishable from automated detection
  // yet sits in sequence with it (PRD #84 story 21).
  const timelineEntries = [
    ...timeline.map((a) => {
      const ev = anomalyEvidence(a);
      return { kind: 'anomaly', time: ev.detectedAt, ev };
    }),
    ...verifications.map((v) => ({ kind: 'verification', time: v.verifiedAt, verification: v })),
  ].sort((a, b) => (a.time ?? 0) - (b.time ?? 0));

  const isDemo = incident.demo === true;

  return (
    <div className="incident-detail">
      {isDemo && (
        <header className="incident-detail__demo" role="note">
          Injected demo incident — synthetic content, not a real detection
        </header>
      )}
      {isOutage && (
        <header className="incident-detail__subject incident-detail__subject--operator">
          <span className="incident-detail__subject-title">
            Feed outage · {OPERATOR_MAP.get(incident.subject.operator)?.name ?? incident.subject.operator}
          </span>
          <span className="incident-detail__subject-note">
            Data problem — the operator feed, not on-the-ground traffic
          </span>
        </header>
      )}
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
        <h3 className="incident-detail__heading">
          Timeline
          {isDemo && <span className="incident-detail__demo-tag"> · Demo</span>}
        </h3>
        <ol className="incident-timeline" role="list">
          {timelineEntries.map((entry) => {
            if (entry.kind === 'verification') {
              const v = entry.verification;
              return (
                <li
                  key={`verification:${v.webcamId}:${v.verifiedAt}`}
                  className="incident-timeline__item incident-timeline__item--verification"
                >
                  <time
                    className="incident-timeline__time"
                    dateTime={v.verifiedAt != null ? new Date(v.verifiedAt).toISOString() : undefined}
                  >
                    {formatTime(v.verifiedAt)}
                  </time>
                  <span className="incident-timeline__rule">Verified via {v.webcamName}</span>
                </li>
              );
            }
            const { ev } = entry;
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

      <section className="incident-detail__webcams" aria-label="Nearby webcams">
        <h3 className="incident-detail__heading">Nearby webcams</h3>
        {webcams.length === 0 ? (
          <p className="incident-webcams__empty">No webcams within range of this incident.</p>
        ) : (
          <ul className="incident-webcams" role="list">
            {webcams.map((camera) => (
              <WebcamItem key={camera.id} camera={camera} onVerify={onVerify} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
