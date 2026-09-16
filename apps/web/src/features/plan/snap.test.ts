import { describe, expect, it } from 'vitest';

import { DEFAULT_STEP, GRID_STEPS, asAnchor, asStep, snapTo, snapValue } from './snap';

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

describe('one coordinate on the grid', () => {
  it('rounds to the nearest line rather than down to the last one', () => {
    expect(snapValue(27, 20)).toBe(20);
    expect(snapValue(31, 20)).toBe(40);
  });

  it('treats a negative coordinate the same way', () => {
    expect(snapValue(-27, 20)).toBe(-20);
    expect(snapValue(-31, 20)).toBe(-40);
  });
});

/*
 * What the grid holds: a corner, or a terminal.
 *
 * Terminals sit at the vertical middle of a node, and nodes are not all the
 * same height — 76 for a bare card, 104 for one with a line, 420 for a full
 * one. Snapping the top-left corner therefore leaves two snapped nodes with
 * their terminals at different offsets, and the line between them has a kink in
 * it that no amount of snapping takes out.
 */
describe('what the grid holds', () => {
  it('puts a terminal on a line, not a corner', () => {
    const height = 76;
    const at = snapTo({ x: 100, y: 103 }, 20, 'terminal', height);
    expect((at.y + height / 2) % 20).toBe(0);
  });

  it('puts the corner on a line when that is what was asked for', () => {
    expect(snapTo({ x: 100, y: 103 }, 20, 'edge', 76)).toEqual({ x: 100, y: 100 });
  });

  it('puts the terminals of two nodes of different heights on the lattice', () => {
    // Not on the same line — each goes to the nearest one, as snapping does.
    // On the lattice, which is what makes a run between any two of them
    // straight once they are dragged to the same height.
    const short = snapTo({ x: 0, y: 103 }, 20, 'terminal', 76);
    const tall = snapTo({ x: 400, y: 219 }, 20, 'terminal', 420);
    expect((short.y + 76 / 2) % 20).toBe(0);
    expect((tall.y + 420 / 2) % 20).toBe(0);
  });

  it('is what puts two terminals at the same height when the corners cannot be', () => {
    // A 76-tall card and a 420-tall one, dropped so their middles are close.
    // By the edge their middles land 30 apart and the line kinks; by the
    // terminal they land together and it runs straight.
    const byEdge = {
      short: snapTo({ x: 0, y: 162 }, 20, 'edge', 76).y + 38,
      tall: snapTo({ x: 400, y: -6 }, 20, 'edge', 420).y + 210,
    };
    const byTerminal = {
      short: snapTo({ x: 0, y: 162 }, 20, 'terminal', 76).y + 38,
      tall: snapTo({ x: 400, y: -6 }, 20, 'terminal', 420).y + 210,
    };
    expect(byEdge).toEqual({ short: 198, tall: 210 });
    expect(byTerminal).toEqual({ short: 200, tall: 200 });
  });

  it('leaves the horizontal alone under either anchor', () => {
    expect(snapTo({ x: 103, y: 0 }, 20, 'terminal', 76).x).toBe(100);
    expect(snapTo({ x: 103, y: 0 }, 20, 'edge', 76).x).toBe(100);
  });

  it('believes only an anchor it was offered', () => {
    expect(asAnchor('terminal')).toBe('terminal');
    expect(asAnchor('edge')).toBe('edge');
    expect(asAnchor('sideways')).toBe('terminal');
    expect(asAnchor(null)).toBe('terminal');
  });
});
