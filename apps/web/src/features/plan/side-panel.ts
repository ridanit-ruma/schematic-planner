/**
 * The shell every panel on the right of the canvas shares.
 *
 * Wide, it is a column beside the drawing. Narrow, 320px of panel would leave
 * the canvas a sliver, so it covers the canvas instead and the close button is
 * the way back — one thing at a time, which is how a phone works anyway.
 */
export const SIDE_PANEL =
  'flex w-full flex-col border-l border-rule bg-surface ' +
  'max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-30 md:w-80 md:shrink-0';
