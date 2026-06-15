import { describe, it, expect } from 'vitest';
import { operatorFeedStatuses } from './feedStatus';

const OPERATORS = [
  { slug: 'sl', name: 'SL' },
  { slug: 'ul', name: 'UL' },
  { slug: 'skane', name: 'Skånetrafiken' },
];

describe('operatorFeedStatuses', () => {
  it('marks operators present in the latest feeds as watched, others as not watched', () => {
    const latest = [
      { operator: 'sl', ok: true, vehicleCount: 50 },
      { operator: 'ul', ok: false, vehicleCount: 0 },
    ];
    const statuses = operatorFeedStatuses(latest, OPERATORS);
    const by = Object.fromEntries(statuses.map((s) => [s.operator, s]));

    expect(by.sl.watched).toBe(true);
    expect(by.ul.watched).toBe(true);
    expect(by.skane.watched).toBe(false); // outside the viewport — never "down"
  });

  it('an unwatched operator is never reported down (no ok/health state)', () => {
    const statuses = operatorFeedStatuses([], OPERATORS);
    for (const s of statuses) {
      expect(s.watched).toBe(false);
      expect(s.healthy).toBeNull(); // unknown, not "down"
    }
  });

  it('a watched operator reports healthy from its latest fetch outcome', () => {
    const latest = [
      { operator: 'sl', ok: true, vehicleCount: 50 },
      { operator: 'ul', ok: false, vehicleCount: 0 },
    ];
    const by = Object.fromEntries(operatorFeedStatuses(latest, OPERATORS).map((s) => [s.operator, s]));
    expect(by.sl.healthy).toBe(true);
    expect(by.ul.healthy).toBe(false);
  });

  it('carries the operator name for display', () => {
    const by = Object.fromEntries(operatorFeedStatuses([], OPERATORS).map((s) => [s.operator, s]));
    expect(by.skane.name).toBe('Skånetrafiken');
  });
});
