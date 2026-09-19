import { describe, expect, it } from 'vitest';

import { LINE_PX, takesTheWheel, wheelPixels } from './use-wheel-scroll';

/**
 * The rule a wheel is decided by, away from the browser it is decided in.
 *
 * The listener itself is three lines of DOM and is proved by the browser gate.
 * What can be wrong without a browser is the question it asks — so the question
 * is kept here, where it can be read and changed on purpose.
 */
describe('takesTheWheel', () => {
  const overflowing = { scrollTop: 0, scrollHeight: 460, clientHeight: 420 };

  it('leaves the wheel alone when there is nothing to scroll', () => {
    expect(takesTheWheel({ scrollTop: 0, scrollHeight: 420, clientHeight: 420 }, 120)).toBe(false);
  });

  it('takes the wheel from a body that overflows', () => {
    expect(takesTheWheel(overflowing, 120)).toBe(true);
  });

  it('takes it upward once the body has been scrolled', () => {
    expect(takesTheWheel({ ...overflowing, scrollTop: 40 }, -120)).toBe(true);
  });

  it('hands it back at the bottom', () => {
    expect(takesTheWheel({ ...overflowing, scrollTop: 40 }, 120)).toBe(false);
  });

  it('and at the top', () => {
    expect(takesTheWheel(overflowing, -120)).toBe(false);
  });
});

describe('wheelPixels', () => {
  it('takes pixels as pixels', () => {
    expect(wheelPixels({ deltaY: 120, deltaMode: 0 }, { clientHeight: 420 })).toBe(120);
  });

  // Firefox sends whole lines for a notch. Read as pixels, a gesture that
  // should have moved fifty moved three.
  it('reads lines as lines', () => {
    expect(wheelPixels({ deltaY: 3, deltaMode: 1 }, { clientHeight: 420 })).toBe(3 * LINE_PX);
  });

  it('reads a page against the box being scrolled', () => {
    expect(wheelPixels({ deltaY: -1, deltaMode: 2 }, { clientHeight: 420 })).toBe(-420);
  });
});
