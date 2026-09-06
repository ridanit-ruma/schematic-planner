import { describe, expect, it } from 'vitest';

import { formatWhen, plural } from './utils';

describe('plural', () => {
  it('agrees with its count', () => {
    expect(plural(1, 'plan')).toBe('1 plan');
    expect(plural(0, 'plan')).toBe('0 plans');
    expect(plural(3, 'plan')).toBe('3 plans');
  });

  it('takes an irregular plural', () => {
    expect(plural(2, 'entry', 'entries')).toBe('2 entries');
  });
});

describe('formatWhen', () => {
  it('gives the time for something from today', () => {
    const today = new Date();
    today.setHours(9, 23, 0, 0);
    expect(formatWhen(today)).toMatch(/9|09/);
  });

  it('gives a date for last night, not a time', () => {
    // Under twenty-four hours old, and still a different day: showing only a
    // clock time here reads as today.
    const lastNight = new Date();
    lastNight.setDate(lastNight.getDate() - 1);
    lastNight.setHours(23, 0, 0, 0);
    expect(formatWhen(lastNight)).not.toMatch(/AM|PM|:\d\d/);
  });

  it('carries the year once it is no longer this one', () => {
    const older = new Date();
    older.setFullYear(older.getFullYear() - 2);
    expect(formatWhen(older)).toMatch(String(new Date().getFullYear() - 2));
  });
});
