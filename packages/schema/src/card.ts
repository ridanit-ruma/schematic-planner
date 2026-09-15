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
  /** Roughly what fits on one line of body at the standard width. */
  charsPerLine: 38,
} as const;

/** Characters that fit on a line at this width, never fewer than a few. */
function perLine(width: number): number {
  return Math.max(12, Math.round((CARD.charsPerLine * width) / CARD.width));
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
    lines += Math.max(1, Math.ceil(line.length / columns));
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
