import type { PlanNode } from './plan.js';

/**
 * How big a card is drawn.
 *
 * The width is a person's to choose and the height is not: what a card has to
 * say decides how tall it is, and a handle offering a height the next render
 * overrules is worse than no handle at all.
 *
 * Two parties need the same numbers and neither can ask the other. The browser
 * draws the card; the server has to place it before any browser has seen the
 * plan, and the Obsidian Canvas export has to write a box for a reader that is
 * neither. So the measurement lives here, and all three call it rather than
 * keeping three estimates that drift.
 */
export const CARD = {
  /** What a card is, unless somebody has said otherwise. */
  width: 260,
  /** How narrow and how wide a person may drag one. */
  minWidth: 180,
  maxWidth: 720,
  /** Title, identifier and padding, before a single line of body. */
  chrome: 56,
  /** A card with nothing to say. */
  minHeight: 76,
  /**
   * Past this a card is drawn full and scrolled rather than made taller.
   *
   * A node whose body is a page should read as a part of a drawing that has a
   * lot in it, not as a wall the lines have to go round. The body is in the
   * inspector and in the export either way.
   */
  maxHeight: 420,
  lineHeight: 16,
  /**
   * Roughly what fits on one line of body at the standard width.
   *
   * Columns, not characters. The number did not change when that distinction
   * arrived; what it counts did. See `textColumns`.
   */
  charsPerLine: 38,
} as const;

/** Columns that fit on a line at this width, never fewer than a few. */
function perLine(width: number): number {
  return Math.max(12, Math.round((CARD.charsPerLine * width) / CARD.width));
}

/**
 * How wide a character is, in columns.
 *
 * A Hangul syllable, a Han character and a kana are full-width — about twice
 * the advance of a Latin letter at the same size. Counting characters instead
 * measured the sentence that takes more room on screen as taking less: 47
 * characters of Korean came to 88 pixels where 90 of Latin came to 104, and the
 * Korean was the longer of the two to look at. The card was then drawn too
 * short and its body scrolled.
 *
 * Two classes and one range test, because the case that is actually broken is
 * the East Asian one and a table of every script's metrics is a table that goes
 * out of date. An emoji is two, which is right; a Devanagari cluster is counted
 * per code point, which is wrong and was wrong before this.
 */
function columnsOf(code: number): number {
  return (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0x303e) ||
    (code >= 0x3041 && code <= 0x33ff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xa000 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f300 && code <= 0x1f64f) ||
    (code >= 0x1f900 && code <= 0x1f9ff) ||
    (code >= 0x20000 && code <= 0x2fffd) ||
    (code >= 0x30000 && code <= 0x3fffd)
    ? 2
    : 1;
}

/**
 * How wide a string is, in columns.
 *
 * Iterated by code point rather than by UTF-16 unit, so a surrogate pair is one
 * character and not two.
 */
export function textColumns(text: string): number {
  let columns = 0;
  for (const character of text) columns += columnsOf(character.codePointAt(0) ?? 0);
  return columns;
}

/**
 * What a card holding this body will be drawn at, at this width.
 *
 * Deterministic: the same body and width always give the same number, so two
 * layout runs over one document do not disagree, and the box the server
 * reserves is the box the browser draws.
 *
 * An estimate, because real wrapping needs a browser. It is deliberately
 * generous — a blank line between blocks costs its own line — and a card whose
 * body outruns the estimate scrolls rather than clipping, which is what the
 * ceiling needs anyway.
 */
export function cardHeight(body: string, width: number = CARD.width): number {
  const text = body.trim();
  if (text === '') return CARD.minHeight;

  const columns = perLine(width);
  let lines = 0;
  for (const line of text.split('\n')) {
    lines += Math.max(1, Math.ceil(textColumns(line) / columns));
  }

  const wanted = CARD.chrome + lines * CARD.lineHeight;
  return Math.min(CARD.maxHeight, Math.max(CARD.minHeight, wanted));
}

/**
 * The box a card occupies: the width it was given or the standard one, and the
 * height that width and that body come to.
 *
 * A stored `size.height` is not read. For a card it is a record of what the
 * height was when the width was chosen, kept so that anything reading the
 * document raw — a JSON Canvas reader, say — sees a coherent box; the moment
 * the body changes it is out of date, and everything in this repository asks
 * this function instead.
 */
export function cardBounds(node: Pick<PlanNode, 'body' | 'size'>): {
  width: number;
  height: number;
} {
  const width = node.size?.width ?? CARD.width;
  return { width, height: cardHeight(node.body, width) };
}
