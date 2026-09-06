/**
 * How large a title is drawn, in canvas units, at a given zoom.
 *
 * A title is the one thing a node cannot be read without, so it is never
 * dropped as the view pulls back: below the zoom where it would shrink out of
 * legibility it grows in canvas units instead, holding roughly its on-screen
 * size and truncating rather than vanishing.
 *
 * The cap keeps an enlarged title inside its own card. Raising it means raising
 * the container top band in @schematic/layout to match, or a group's first
 * child will sit under the group's own label.
 */
export const MIN_TITLE_PX = 11;
export const MAX_TITLE_PX = 34;

export function titleSize(base: number, zoom: number): number {
  return Math.min(MAX_TITLE_PX, Math.max(base, MIN_TITLE_PX / Math.max(zoom, 0.05)));
}
