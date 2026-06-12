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
  };
}
