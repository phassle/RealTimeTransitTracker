import { describe, it, expect } from 'vitest';
import {
  createObservationBuffer,
  DEFAULT_WINDOW_MS,
  RECORDING_VERSION,
  RECORDING_FORMAT,
  parseRecording,
  RecordingError,
} from './observationBuffer';

const v = (id) => ({ id, latitude: 59.3, longitude: 18.0, tripId: 'T' });

describe('observationBuffer', () => {
  it('retains appended snapshots in chronological order', () => {
    const buf = createObservationBuffer();
    buf.append({ time: 1000, vehicles: [v('a')] });
    buf.append({ time: 2000, vehicles: [v('b')] });

    const snaps = buf.snapshots();
    expect(snaps).toHaveLength(2);
    expect(snaps[0].time).toBe(1000);
    expect(snaps[1].time).toBe(2000);
  });

  it('trims snapshots older than the rolling window', () => {
    const buf = createObservationBuffer({ windowMs: 5000 });
    buf.append({ time: 0, vehicles: [v('old')] });
    buf.append({ time: 3000, vehicles: [v('mid')] });
    buf.append({ time: 6000, vehicles: [v('new')] });

    const times = buf.snapshots().map(s => s.time);
    // cutoff = 6000 - 5000 = 1000; the t=0 snapshot is dropped
    expect(times).toEqual([3000, 6000]);
  });

  it('defaults vehicles to an empty array', () => {
    const buf = createObservationBuffer();
    buf.append({ time: 1, vehicles: undefined });
    expect(buf.snapshots()[0].vehicles).toEqual([]);
  });

  it('records per-operator fetch outcomes (feeds) on the snapshot', () => {
    const buf = createObservationBuffer();
    const feeds = [{ operator: 'sl', ok: true, vehicleCount: 12, dataTimestamp: 1000 }];
    buf.append({ time: 1, vehicles: [v('a')], feeds });
    expect(buf.snapshots()[0].feeds).toEqual(feeds);
  });

  it('defaults feeds to an empty array', () => {
    const buf = createObservationBuffer();
    buf.append({ time: 1, vehicles: [v('a')] });
    expect(buf.snapshots()[0].feeds).toEqual([]);
  });

  it('exposes a default ~30 min window', () => {
    expect(DEFAULT_WINDOW_MS).toBe(30 * 60 * 1000);
  });

  it('clear() empties the buffer', () => {
    const buf = createObservationBuffer();
    buf.append({ time: 1, vehicles: [v('a')] });
    buf.clear();
    expect(buf.size()).toBe(0);
  });

  describe('at(time) — read-at-time for Replay', () => {
    it('returns the vehicles of the snapshot at or before the requested time', () => {
      const buf = createObservationBuffer();
      buf.append({ time: 1000, vehicles: [v('a')] });
      buf.append({ time: 2000, vehicles: [v('b')] });
      buf.append({ time: 3000, vehicles: [v('c')] });

      // exact hit
      expect(buf.at(2000).map(x => x.id)).toEqual(['b']);
      // between snapshots → the most recent one at-or-before
      expect(buf.at(2500).map(x => x.id)).toEqual(['b']);
      // after the last → the last snapshot
      expect(buf.at(9999).map(x => x.id)).toEqual(['c']);
    });

    it('clamps reads before the first snapshot to the earliest snapshot', () => {
      const buf = createObservationBuffer();
      buf.append({ time: 1000, vehicles: [v('a')] });
      buf.append({ time: 2000, vehicles: [v('b')] });
      // never claims data from before the session — returns the earliest snapshot
      expect(buf.at(0).map(x => x.id)).toEqual(['a']);
    });

    it('returns an empty array when the buffer is empty', () => {
      const buf = createObservationBuffer();
      expect(buf.at(1000)).toEqual([]);
    });

    it('exposes the session window range (earliest..latest)', () => {
      const buf = createObservationBuffer();
      expect(buf.range()).toBeNull();
      buf.append({ time: 1000, vehicles: [v('a')] });
      buf.append({ time: 3000, vehicles: [v('b')] });
      expect(buf.range()).toEqual({ start: 1000, end: 3000 });
    });
  });

  describe('Recording export/import', () => {
    it('exports a versioned envelope carrying the snapshots', () => {
      const buf = createObservationBuffer({ windowMs: 5000 });
      buf.append({ time: 1000, vehicles: [v('a')] });
      buf.append({ time: 2000, vehicles: [v('b')] });

      const rec = buf.exportRecording();
      expect(rec.format).toBe(RECORDING_FORMAT);
      expect(rec.version).toBe(RECORDING_VERSION);
      expect(rec.windowMs).toBe(5000);
      expect(rec.snapshots.map(s => s.time)).toEqual([1000, 2000]);
      expect(rec.snapshots[0].vehicles.map(x => x.id)).toEqual(['a']);
    });

    it('round-trips through JSON and reads back the captured positions', () => {
      const source = createObservationBuffer();
      source.append({ time: 1000, vehicles: [v('a')] });
      source.append({ time: 2000, vehicles: [v('b')] });
      const json = JSON.stringify(source.exportRecording());

      const target = createObservationBuffer();
      target.importRecording(json);

      expect(target.range()).toEqual({ start: 1000, end: 2000 });
      expect(target.at(1000).map(x => x.id)).toEqual(['a']);
      expect(target.at(2000).map(x => x.id)).toEqual(['b']);
    });

    it('imports a parsed envelope object as well as a JSON string', () => {
      const source = createObservationBuffer();
      source.append({ time: 7, vehicles: [v('z')] });

      const target = createObservationBuffer();
      target.importRecording(source.exportRecording());
      expect(target.at(7).map(x => x.id)).toEqual(['z']);
    });

    it('rejects a non-Recording file without touching the existing buffer', () => {
      const buf = createObservationBuffer();
      buf.append({ time: 1000, vehicles: [v('live')] });

      expect(() => buf.importRecording('{"hello":"world"}')).toThrow(RecordingError);
      // buffer is unaffected
      expect(buf.range()).toEqual({ start: 1000, end: 1000 });
      expect(buf.at(1000).map(x => x.id)).toEqual(['live']);
    });

    it('rejects malformed JSON cleanly', () => {
      const buf = createObservationBuffer();
      expect(() => buf.importRecording('not json {')).toThrow(RecordingError);
    });

    it('rejects an unsupported version with a clear message', () => {
      const buf = createObservationBuffer();
      buf.append({ time: 5, vehicles: [v('live')] });
      const futureRec = {
        format: RECORDING_FORMAT,
        version: RECORDING_VERSION + 1,
        windowMs: 1000,
        snapshots: [],
      };
      expect(() => buf.importRecording(futureRec)).toThrow(/version/i);
      // unaffected
      expect(buf.at(5).map(x => x.id)).toEqual(['live']);
    });

    it('rejects an envelope whose snapshots are malformed', () => {
      const buf = createObservationBuffer();
      const bad = {
        format: RECORDING_FORMAT,
        version: RECORDING_VERSION,
        windowMs: 1000,
        snapshots: [{ time: 'soon', vehicles: 'nope' }],
      };
      expect(() => buf.importRecording(bad)).toThrow(RecordingError);
    });

    it('parseRecording validates without needing a buffer', () => {
      const rec = {
        format: RECORDING_FORMAT,
        version: RECORDING_VERSION,
        windowMs: 1000,
        snapshots: [{ time: 1, vehicles: [] }],
      };
      expect(parseRecording(rec).snapshots).toHaveLength(1);
      expect(() => parseRecording(null)).toThrow(RecordingError);
    });
  });
});
