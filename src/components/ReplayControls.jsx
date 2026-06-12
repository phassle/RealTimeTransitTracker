import './ReplayControls.css';

// ReplayControls — scrub the session observation window (PRD #84, stories 22-24).
// A slider bounded to the session window reads the buffer at a chosen past
// moment; an unmistakable past-mode indicator plus a one-click return to live
// keep the operator from acting on stale positions believing they are current.
// Bounded to "since tab open, capped at the rolling window" — never implies
// history it does not have.

function formatTime(t) {
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function ReplayControls({ replay }) {
  const { isReplaying, viewedTime, sessionStart, sessionEnd } = replay;

  // No observations yet → nothing to scrub.
  if (sessionStart == null || sessionEnd == null) return null;

  const value = viewedTime ?? sessionEnd;

  return (
    <div className={`replay-controls${isReplaying ? ' replay-controls--past' : ''}`}>
      {isReplaying && (
        <div className="replay-controls__indicator" role="status">
          <span className="replay-controls__badge">● Viewing the past</span>
          <span className="replay-controls__time">{formatTime(viewedTime)}</span>
        </div>
      )}
      <input
        className="replay-controls__slider"
        type="range"
        min={sessionStart}
        max={sessionEnd}
        value={value}
        step={1000}
        aria-label="Scrub the session window"
        onChange={(e) => replay.scrubTo(Number(e.target.value))}
      />
      <div className="replay-controls__ends">
        <span>{formatTime(sessionStart)}</span>
        {isReplaying ? (
          <button
            type="button"
            className="replay-controls__live"
            onClick={replay.returnToLive}
          >
            Return to live
          </button>
        ) : (
          <span className="replay-controls__live-label">● Live</span>
        )}
        <span>{formatTime(sessionEnd)}</span>
      </div>
    </div>
  );
}
