import { describe, expect, it } from 'vitest';

import { sharePreviewHtml } from './share-preview.js';

const base = {
  title: 'Billing rework',
  description: 'How an invoice gets from the ledger to a PDF.',
  nodeCount: 12,
  url: 'https://example.invalid/share/abc',
  image: 'https://example.invalid/assets/og.png',
};

describe('the card a share link unfurls into', () => {
  it('names the plan and says how big it is', () => {
    const html = sharePreviewHtml(base);
    expect(html).toContain('<meta property="og:title" content="Billing rework" />');
    expect(html).toContain('ledger to a PDF. — 12 nodes.');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
  });

  it('says something useful about a plan with no description', () => {
    const html = sharePreviewHtml({ ...base, description: '', nodeCount: 1 });
    expect(html).toContain('content="A plan on the canvas — 1 node."');
  });

  it('falls back to a name for a plan that has none', () => {
    expect(sharePreviewHtml({ ...base, title: '   ' })).toContain('content="Untitled plan"');
  });

  it('sends a person on to the application rather than showing them this', () => {
    const html = sharePreviewHtml(base);
    expect(html).toContain('content="0; url=https://example.invalid/share/abc"');
    expect(html).toContain('<a href="https://example.invalid/share/abc">');
  });

  /* Search engines should not carry a capability token around. */
  it('asks not to be indexed', () => {
    expect(sharePreviewHtml(base)).toContain('<meta name="robots" content="noindex" />');
  });
});

/**
 * The title and description are written by anyone who can edit the plan, and
 * this is the one place in the product where they reach a browser as markup.
 */
describe('a title that is trying to be markup', () => {
  it('cannot end the attribute it sits in', () => {
    const html = sharePreviewHtml({ ...base, title: '" onload="alert(1)' });
    expect(html).toContain('content="&quot; onload=&quot;alert(1)"');
    expect(html).not.toContain('onload="alert(1)"');
  });

  it('cannot open a tag', () => {
    const html = sharePreviewHtml({ ...base, title: '</title><script>alert(1)</script>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;/title&gt;&lt;script&gt;');
  });

  it('escapes an apostrophe too, because an attribute may be quoted either way', () => {
    expect(sharePreviewHtml({ ...base, title: "it's" })).toContain('content="it&#39;s"');
  });

  it('does not double-escape an ampersand into nonsense', () => {
    const html = sharePreviewHtml({ ...base, title: 'A & B' });
    expect(html).toContain('content="A &amp; B"');
    expect(html).not.toContain('&amp;amp;');
  });

  it('escapes the description as well as the title', () => {
    const html = sharePreviewHtml({ ...base, description: '"><img src=x onerror=alert(1)>' });
    expect(html).not.toContain('<img');
    expect(html).toContain('&quot;&gt;&lt;img');
  });
});
