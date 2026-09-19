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
  it('leaves the wheel alone when there is nothing to scroll', () => {
    expect(takesTheWheel({ scrollHeight: 420, clientHeight: 420 })).toBe(false);
  });

  /*
   * Issue #7, and the whole of the change: the rule asks one thing, whether
   * this box overflows, and nothing about where it is resting or which way the
   * wheel is going. It used to ask for room in the direction of the wheel, so a
   * body at either end handed the wheel back and the canvas zoomed under
   * somebody in the middle of reading. A scroll that has run out simply stops.
   *
   * That the ends now hold is a fact about a real wheel in a real browser, and
   * it is the gate that checks it: `and keeps the wheel at the bottom, where
   * the canvas used to take over`.
   */
  it('takes the wheel from a body that overflows, whatever the wheel is doing', () => {
    expect(takesTheWheel({ scrollHeight: 460, clientHeight: 420 })).toBe(true);
  });

  // A sub-pixel difference is rounding and not a scroll: a card overflowing by
  // half a pixel would otherwise be a hole in the zoom surface.
  it('ignores an overflow of less than a pixel', () => {
    expect(takesTheWheel({ scrollHeight: 420.4, clientHeight: 420 })).toBe(false);
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
