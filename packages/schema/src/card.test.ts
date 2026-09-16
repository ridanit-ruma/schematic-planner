import { describe, expect, it } from 'vitest';

import { CARD, cardBounds, cardHeight, textColumns } from './card.js';

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

/*
 * A character is counted by how wide it is, not by being a character.
 *
 * A Hangul syllable, a Han character and a kana are full-width — about twice
 * the advance of a Latin letter at the same size — so a line of a 260-wide card
 * holds about nineteen of them and about thirty-eight of these. Counted as one
 * each, the sentence that takes more room on screen was measured as taking
 * less, and the card was drawn too short and scrolled.
 */
describe('a body that is not written in Latin letters', () => {
  const korean = '이 문장은 기본 폭의 카드에서 한 줄을 훌쩍 넘길 만큼 충분히 길게 쓰인 문장입니다.';
  const latin = 'A sentence long enough that it has to wrap more than once on a card of the standard width.';

  it('gives a full-width line the room it takes', () => {
    // These two wrap to the same three lines at the standard width, which is
    // the point: 47 characters of Korean take about as much room as 90 of
    // Latin. Counted as characters the Korean one came to 88 against 104 — the
    // longer of the two to look at, measured as the shorter.
    expect(cardHeight(korean)).toBe(cardHeight(latin));
  });

  it('is taller for a body that genuinely runs longer', () => {
    // Six of those lines is where the old count went badly wrong: 248 against
    // the 344 the same amount of Latin was given, so the card was drawn a
    // hundred pixels short and the text scrolled inside it.
    const six = Array(6).fill(korean).join('\n');
    expect(cardHeight(six)).toBe(cardHeight(Array(6).fill(latin).join('\n')));
    expect(cardHeight(six)).toBeGreaterThan(300);
  });

  it('counts a full-width character as two columns', () => {
    expect(textColumns('가나다')).toBe(6);
    expect(textColumns('abc')).toBe(3);
    expect(textColumns('가b다')).toBe(5);
  });

  it('counts one emoji as one character, however it is stored', () => {
    // A surrogate pair is one code point, not two. Wrong to call it one column
    // wide, and wrong in the same way it was before this; what matters here is
    // that it is not counted twice for being long in UTF-16.
    expect(textColumns('😀')).toBe(2);
  });

  it('is unchanged for text that was already measured correctly', () => {
    expect(textColumns(latin)).toBe(latin.length);
  });
});
