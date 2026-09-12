import { describe, expect, it } from 'vitest';

import { DEFAULT_STEP, GRID_STEPS, asStep, snapTo } from './snap';

describe('snapping a position to the grid', () => {
  it('leaves a position that is already on a line where it is', () => {
    expect(snapTo({ x: 40, y: 100 }, 20)).toEqual({ x: 40, y: 100 });
  });

  it('moves to the nearer line rather than always the one before', () => {
    expect(snapTo({ x: 31, y: 29 }, 20)).toEqual({ x: 40, y: 20 });
  });

  it('settles a halfway case the same way every time', () => {
    expect(snapTo({ x: 10, y: 10 }, 20)).toEqual(snapTo({ x: 10, y: 10 }, 20));
  });

  /* The origin is wherever the first card was laid, so half the canvas is negative. */
  it('works left of and above the origin', () => {
    expect(snapTo({ x: -31, y: -29 }, 20)).toEqual({ x: -40, y: -20 });
  });

  it('does not accumulate drift when applied to its own output', () => {
    const once = snapTo({ x: 137.4, y: -43.8 }, 40);
    expect(snapTo(once, 40)).toEqual(once);
  });

  it('returns whole numbers for every offered step, because positions are stored rounded', () => {
    for (const step of GRID_STEPS) {
      const at = snapTo({ x: 137.4, y: -43.8 }, step);
      expect(Number.isInteger(at.x)).toBe(true);
      expect(Number.isInteger(at.y)).toBe(true);
    }
  });
});

/**
 * The step is read back from `localStorage`, which holds whatever was last
 * written there — by this version, an older one, or a person with a console open.
 */
describe('believing a stored step', () => {
  it('takes one of the offered steps', () => {
    expect(asStep('40')).toBe(40);
    expect(asStep(80)).toBe(80);
  });

  it.each([null, undefined, '', 'wide', Number.NaN, 33, -20, Infinity])(
    'falls back to the default for %p',
    (value) => {
      expect(asStep(value)).toBe(DEFAULT_STEP);
    },
  );

  /* A step of zero would divide by zero and pile every node on the origin. */
  it('refuses zero', () => {
    expect(asStep(0)).toBe(DEFAULT_STEP);
    expect(snapTo({ x: 137, y: 43 }, asStep(0))).toEqual({ x: 140, y: 40 });
  });
});
