import { describe, expect, it } from 'vitest';

import { durationToMs } from './duration.js';

describe('durationToMs', () => {
  it('understands the units used in .env', () => {
    expect(durationToMs('30s')).toBe(30_000);
    expect(durationToMs('15m')).toBe(900_000);
    expect(durationToMs('2h')).toBe(7_200_000);
    expect(durationToMs('30d')).toBe(2_592_000_000);
  });

  it('rejects anything it cannot read', () => {
    expect(() => durationToMs('later')).toThrow();
    expect(() => durationToMs('10')).toThrow();
    expect(() => durationToMs('10w')).toThrow();
  });
});
