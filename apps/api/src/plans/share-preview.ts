export interface SharePreview {
  readonly title: string;
  readonly description: string;
  readonly nodeCount: number;
  /** Where a person following the link should end up. */
  readonly url: string;
  readonly image: string;
}

/**
 * Escapes for an HTML attribute, which is the only context anything here lands
 * in.
 *
 * A plan's title and description are written by whoever can edit the plan, and
 * this is the one place in the product where they reach a browser as markup
 * rather than as text a framework escapes. A single unescaped quote would end
 * the attribute and let the rest of the title become markup, so all five
 * characters go -- including the apostrophe, since an attribute may be quoted
 * either way and a reader should not have to check which.
 */
function attribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** One line, and short enough that an unfurler does not cut it mid-word. */
function summarise(description: string, nodeCount: number): string {
  const flat = description.replace(/\s+/g, ' ').trim();
  const size = nodeCount === 1 ? '1 node' : `${nodeCount} nodes`;
  if (flat === '') return `A plan on the canvas — ${size}.`;
  const room = 180;
  const clipped = flat.length > room ? `${flat.slice(0, room).trimEnd()}…` : flat;
  return `${clipped} — ${size}.`;
}

/**
 * The card a share link unfurls into.
 *
 * Only a share link gets one. A link to the application itself must not say
 * what is behind it: an unfurl is rendered for everybody in the channel it was
 * pasted into, and most of them cannot open the plan. A share link is the one
 * address where that reasoning runs the other way — it is a capability handed
 * out on purpose, and anybody holding it can already read the whole plan, so
 * naming it in the preview gives away nothing the link does not.
 *
 * This is served to link unfurlers, not to people. A person following the link
 * is sent on to the application, which is what the refresh and the anchor are
 * for -- a crawler ignores both.
 */
export function sharePreviewHtml(preview: SharePreview): string {
  const title = attribute(preview.title.trim() === '' ? 'Untitled plan' : preview.title);
  const summary = attribute(summarise(preview.description, preview.nodeCount));
  const url = attribute(preview.url);
  const image = attribute(preview.image);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title} — Schematic Planner</title>
    <meta name="description" content="${summary}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Schematic Planner" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${summary}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${image}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${summary}" />
    <meta name="twitter:image" content="${image}" />
    <meta name="robots" content="noindex" />
    <meta http-equiv="refresh" content="0; url=${url}" />
  </head>
  <body>
    <a href="${url}">${title}</a>
  </body>
</html>
`;
}
