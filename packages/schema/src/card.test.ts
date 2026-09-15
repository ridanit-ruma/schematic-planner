import { describe, expect, it } from 'vitest';

import { CARD, cardHeight } from './card.js';

describe('the height a card will be drawn at', () => {
  it('is the bare card when there is nothing to say', () => {
    expect(cardHeight('')).toBe(CARD.minHeight);
    expect(cardHeight('   \n  ')).toBe(CARD.minHeight);
  });

  it('grows with what there is to say', () => {
    const one = cardHeight('one line');
    const four = cardHeight('one\ntwo\nthree\nfour');
    expect(four).toBeGreaterThan(one);
  });

  it('counts a long line as the several it wraps into', () => {
    const short = cardHeight('short');
    const wrapped = cardHeight('x'.repeat(CARD.charsPerLine * 4));
    expect(wrapped).toBeGreaterThan(short);
  });

  it('stops at a card you can read rather than a wall', () => {
    expect(cardHeight('line\n'.repeat(400))).toBe(CARD.maxHeight);
  });

  it('is the same answer twice, so two layout runs agree', () => {
    const body = 'a body\nwith some lines\nin it';
    expect(cardHeight(body)).toBe(cardHeight(body));
  });
});
