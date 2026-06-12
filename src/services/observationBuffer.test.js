import { describe, it, expect } from 'vitest';
import { createObservationBuffer, DEFAULT_WINDOW_MS } from './observationBuffer';

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
});
