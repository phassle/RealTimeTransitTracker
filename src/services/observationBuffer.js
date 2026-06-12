// Observation buffer — rolling in-memory window of per-poll vehicle snapshots.
//
// A pure service (no React, no I/O). Each poll appends a snapshot
// { time, vehicles }; the buffer trims anything older than the rolling
// window. Reads serve the anomaly rules (and, later, Replay / Dwell spots).
// All command-center state lives in memory only — ADR 0003 / ADR 0001.

export const DEFAULT_WINDOW_MS = 30 * 60 * 1000; // ~30 min rolling window

export function createObservationBuffer({ windowMs = DEFAULT_WINDOW_MS } = {}) {
  let snapshots = [];

  return {
    /**
     * Append a snapshot and trim anything outside the rolling window.
     * @param {{ time: number, vehicles: object[] }} snapshot
     * @returns {number} the number of snapshots retained
     */
    append({ time, vehicles }) {
      snapshots.push({ time, vehicles: vehicles ?? [] });
      const cutoff = time - windowMs;
      snapshots = snapshots.filter(s => s.time >= cutoff);
      return snapshots.length;
    },

    /** Chronological snapshots currently inside the window. */
    snapshots() {
      return snapshots;
    },

    size() {
      return snapshots.length;
    },

    clear() {
      snapshots = [];
    },
  };
}
