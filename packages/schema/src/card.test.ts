import { describe, expect, it } from 'vitest';

import { CARD, cardBounds, cardHeight } from './card.js';

describe('the height a card is drawn at', () => {
  it('is the bare card when there is nothing to say', () => {
    expect(cardHeight('')).toBe(CARD.minHeight);
    expect(cardHeight('   \n  ')).toBe(CARD.minHeight);
  });

  it('grows with what there is to say', () => {
    expect(cardHeight('one\ntwo\nthree\nfour')).toBeGreaterThan(cardHeight('one line'));
  });

  it('counts a long line as the several it wraps into', () => {
    expect(cardHeight('x'.repeat(CARD.charsPerLine * 4))).toBeGreaterThan(cardHeight('short'));
  });

  it('needs less height at a greater width, because less wraps', () => {
    const body = 'x'.repeat(CARD.charsPerLine * 6);
    expect(cardHeight(body, CARD.width * 2)).toBeLessThan(cardHeight(body, CARD.width));
  });

  it('stops at a card you can read rather than a wall', () => {
    expect(cardHeight('line\n'.repeat(400))).toBe(CARD.maxHeight);
  });

  it('is the same answer twice, so two layout runs agree', () => {
    const body = 'a body\nwith some lines\nin it';
    expect(cardHeight(body)).toBe(cardHeight(body));
  });
});

describe('the box a card occupies', () => {
  it('is the standard width for a card nobody has sized', () => {
    expect(cardBounds({ body: '', size: null })).toEqual({
      width: CARD.width,
      height: CARD.minHeight,
    });
  });

  it('takes the width it was given', () => {
    expect(cardBounds({ body: '', size: { width: 420, height: 999 } }).width).toBe(420);
  });

  it('measures the height at that width, never reading the stored one', () => {
    const bounds = cardBounds({ body: 'a line', size: { width: 420, height: 999 } });
    expect(bounds.height).toBe(cardHeight('a line', 420));
    expect(bounds.height).not.toBe(999);
  });
});
