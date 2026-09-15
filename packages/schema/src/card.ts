/**
 * How big a card is drawn.
 *
 * Two parties need the same answer and neither can ask the other. The browser
 * decides a card's real height by laying its text out; the server has to place
 * cards before any browser has seen them, so it has to predict that height. A
 * prediction that disagrees with the drawing spaces the plan for boxes that are
 * not the ones on screen — which is what two constants named
 * `CARD_HEIGHT` and `CARD_HEIGHT_WITH_BODY` were already doing, more crudely.
 *
 * So the numbers live here, where both sides already look, and the estimate is
 * a function rather than a pair of constants.
 */
export const CARD = {
  width: 260,
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
  maxHeight: 320,
  lineHeight: 16,
  /** Roughly what fits on one line at the card width and body size. */
  charsPerLine: 38,
} as const;

/**
 * What a card holding this body will be drawn at, near enough to lay out
 * around. Deterministic: the same body always gives the same number, so two
 * layout runs over one document do not disagree.
 */
export function cardHeight(body: string): number {
  const text = body.trim();
  if (text === '') return CARD.minHeight;

  let lines = 0;
  for (const line of text.split('\n')) {
    lines += Math.max(1, Math.ceil(line.length / CARD.charsPerLine));
  }

  const wanted = CARD.chrome + lines * CARD.lineHeight;
  return Math.min(CARD.maxHeight, Math.max(CARD.minHeight, wanted));
}
