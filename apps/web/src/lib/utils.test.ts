import { describe, expect, it } from 'vitest';

import { plural } from './utils';

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
