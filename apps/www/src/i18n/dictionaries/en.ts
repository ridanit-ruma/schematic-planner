/** The words around every page — the header, the footer, the site's name in a card. */
export const en = {
  site: {
    tagline: 'Plan in the browser. Own the output.',
    ogAlt: 'A plan on the canvas',
  },
  nav: {
    guide: 'Guide',
    docs: 'Docs',
    source: 'Source',
    openApp: 'Open the app',
    language: 'Language',
  },
  footer: {
    about: 'Draw how a system works, edit it with your agent, and take the Markdown with you.',
    status: 'Pre-alpha. Self-hosted, and no email is ever sent.',
    product: 'Product',
    connectAgent: 'Connect an agent',
    source: 'Source',
    repository: 'Repository',
    issues: 'Issues',
    runItYourself: 'Run it yourself',
    legal: 'Legal',
    terms: 'Terms',
    privacy: 'Privacy',
    closing: 'AGPL-3.0. Run it yourself — the plans stay on your own machine.',
  },
};

type Widen<T> = T extends string ? string : { readonly [K in keyof T]: Widen<T[K]> };

export type Dictionary = Widen<typeof en>;
