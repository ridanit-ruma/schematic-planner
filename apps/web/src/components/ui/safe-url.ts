/** The only schemes a link in a plan may carry. */
const ALLOWED = ['http:', 'https:', 'mailto:'];

/**
 * A link a plan may draw, or nothing.
 *
 * A plan opens through a share link with no login, so a link in a document
 * somebody else wrote reaches a reader who never agreed to trust its author.
 * `javascript:` and `data:` are the obvious ones; `//host` is the one that looks
 * relative and is not; and whitespace inside a scheme is stripped by the browser
 * before the scheme is read, so it is stripped here before it is asked about.
 *
 * Returning nothing renders the words without a link rather than dropping them:
 * what somebody wrote is still worth reading.
 */
export function safeUrl(href: string): string | undefined {
  // By code point rather than by a character class, because the class for it is
  // a range of control characters and reads as a mistake wherever it appears.
  const bare = [...href]
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code > 0x20 && code !== 0x7f;
    })
    .join('');
  if (bare === '') return undefined;
  // Protocol-relative: no scheme of its own, and it takes the page's.
  if (bare.startsWith('//')) return undefined;

  const colon = bare.indexOf(':');
  const slash = bare.indexOf('/');
  // A colon after the first slash is part of a path, not a scheme.
  const scheme = colon === -1 || (slash !== -1 && slash < colon) ? null : bare.slice(0, colon + 1);

  if (scheme === null) return href;
  return ALLOWED.includes(scheme.toLowerCase()) ? href : undefined;
}
