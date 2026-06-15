// Observation buffer — rolling in-memory window of per-poll vehicle snapshots.
//
// A pure service (no React, no I/O). Each poll appends a snapshot
// { time, vehicles }; the buffer trims anything older than the rolling
// window. Reads serve the anomaly rules (and, later, Replay / Dwell spots).
// All command-center state lives in memory only — ADR 0003 / ADR 0001.

export const DEFAULT_WINDOW_MS = 30 * 60 * 1000; // ~30 min rolling window

// A Recording is the observation buffer serialized to a versioned JSON
// envelope so a demo can be exported to disk and loaded back later for Replay
// (PRD #84 story 25; story 30 — file on disk, never client storage). The
// version lets old/foreign files be rejected cleanly without harming the
// live session.
export const RECORDING_FORMAT = 'rtt-recording';
export const RECORDING_VERSION = 1;

// Thrown by parseRecording / importRecording when a file is not a valid
// Recording or carries an unsupported version. Carries an operator-facing
// message so the import can be refused with a clear reason.
export class RecordingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RecordingError';
  }
}

function isValidSnapshot(s) {
  return (
    s != null &&
    typeof s === 'object' &&
    typeof s.time === 'number' &&
    Number.isFinite(s.time) &&
    Array.isArray(s.vehicles)
  );
}

/**
 * Validate (and, for a string, JSON-parse) a Recording envelope. Pure: no
 * buffer, no I/O. Returns the parsed { version, windowMs, snapshots } on
 * success; throws RecordingError with a clear message otherwise — so callers
 * can validate before mutating any live state.
 * @param {string | object} input
 * @returns {{ version: number, windowMs: number, snapshots: object[] }}
 */
export function parseRecording(input) {
  let data = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch {
      throw new RecordingError('Not a valid Recording file (could not parse JSON).');
    }
  }
  if (data == null || typeof data !== 'object' || data.format !== RECORDING_FORMAT) {
    throw new RecordingError('Not a valid Recording file.');
  }
  if (data.version !== RECORDING_VERSION) {
    throw new RecordingError(
      `Unsupported Recording version: ${data.version} (expected ${RECORDING_VERSION}).`,
    );
  }
  if (!Array.isArray(data.snapshots) || !data.snapshots.every(isValidSnapshot)) {
    throw new RecordingError('Recording is malformed (invalid snapshots).');
  }
  return {
    version: data.version,
    windowMs: typeof data.windowMs === 'number' ? data.windowMs : DEFAULT_WINDOW_MS,
    snapshots: data.snapshots,
  };
}

export function createObservationBuffer({ windowMs = DEFAULT_WINDOW_MS } = {}) {
  let snapshots = [];

  return {
    /**
     * Append a snapshot and trim anything outside the rolling window.
     * `feeds` are the per-operator fetch outcomes for this poll
     * ({ operator, ok, vehicleCount, dataTimestamp }); the feed-outage rules
     * read them across the window. No new feed calls — these are recorded from
     * the polling that already happens.
     * @param {{ time: number, vehicles: object[], feeds?: object[] }} snapshot
     * @returns {number} the number of snapshots retained
     */
    append({ time, vehicles, feeds }) {
      snapshots.push({ time, vehicles: vehicles ?? [], feeds: feeds ?? [] });
      const cutoff = time - windowMs;
      snapshots = snapshots.filter(s => s.time >= cutoff);
      return snapshots.length;
    },

    /** Chronological snapshots currently inside the window. */
    snapshots() {
      return snapshots;
    },

    /**
     * Read-at-time for Replay: the vehicles of the snapshot at or before
     * `time`. Reads before the earliest retained snapshot clamp to it, so the
     * view never claims data from before the session window. Empty buffer → [].
     * @param {number} time
     * @returns {object[]}
     */
    at(time) {
      if (snapshots.length === 0) return [];
      let chosen = snapshots[0];
      for (const s of snapshots) {
        if (s.time <= time) chosen = s;
        else break;
      }
      return chosen.vehicles;
    },

    /**
     * The session window bounds spanned by retained snapshots, or null when
     * empty. `start` is "since tab open, capped at the rolling window".
     * @returns {{ start: number, end: number } | null}
     */
    range() {
      if (snapshots.length === 0) return null;
      return { start: snapshots[0].time, end: snapshots[snapshots.length - 1].time };
    },

    size() {
      return snapshots.length;
    },

    clear() {
      snapshots = [];
    },

    /**
     * Serialize the current window to a versioned Recording envelope, ready to
     * be JSON-stringified to a file on disk (ADR 0001/0003 — no client
     * storage). Snapshots are shallow-copied so the export can't be mutated by
     * later appends.
     * @returns {{ format: string, version: number, windowMs: number, snapshots: object[] }}
     */
    exportRecording() {
      return {
        format: RECORDING_FORMAT,
        version: RECORDING_VERSION,
        windowMs,
        snapshots: snapshots.map(s => ({ time: s.time, vehicles: s.vehicles })),
      };
    },

    /**
     * Replace the buffer with the snapshots from a Recording so Replay can
     * scrub the captured window. Validation happens before any mutation: a
     * malformed or wrong-version file throws RecordingError and leaves the
     * existing buffer untouched.
     * @param {string | object} input — JSON string or parsed envelope
     * @returns {number} the number of snapshots loaded
     */
    importRecording(input) {
      const parsed = parseRecording(input);
      snapshots = parsed.snapshots.map(s => ({ time: s.time, vehicles: s.vehicles }));
      return snapshots.length;
    },
  };
}
