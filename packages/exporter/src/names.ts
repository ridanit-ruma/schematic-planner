/**
 * A note's file is named after its title, not its slug.
 *
 * The slug is the identity — stable, ASCII, safe in a URL — and it stays in
 * frontmatter. It is a poor filename: a vault written in Korean has no ASCII
 * slug that resembles it, so exporting used to rename every file, which broke
 * every `[[wikilink]]` already written between them and made a round trip
 * impossible.
 *
 * What has to go is only what a filesystem or a wikilink cannot carry: path
 * separators, the characters Windows refuses, and the four Obsidian gives a
 * meaning to inside a link.
 */
// Control characters are deliberate here, not the accident the rule guards
// against: a filename carrying one is a filename no archive tool agrees about.
// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[\u0000-\u001f\u007f/\\:*?"<>|[\]#^]/g;

/** Windows refuses these whatever the extension, and a zip is opened anywhere. */
const RESERVED = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`),
]);

const MAX = 80;

export function fileName(title: string, slug: string): string {
  const cleaned = title
    .replace(FORBIDDEN, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // A leading dot hides the file; a trailing dot or space is dropped silently
    // by Windows, which turns two distinct names into one.
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '')
    .slice(0, MAX)
    .replace(/[. ]+$/, '');

  if (cleaned === '' || RESERVED.has(cleaned.toLowerCase())) return slug;
  return cleaned;
}

/**
 * The same names, made unique among themselves. Two notes may share a title —
 * "Overview", "Notes" — and two files in one directory may not share a name.
 */
export function uniqueNames(
  entries: readonly { slug: string; title: string }[],
): ReadonlyMap<string, string> {
  const taken = new Set<string>();
  const out = new Map<string, string>();

  for (const entry of entries) {
    const wanted = fileName(entry.title, entry.slug);
    // The slug is what tells two same-named notes apart, so it is what
    // disambiguates their files.
    let name = taken.has(wanted.toLowerCase()) ? `${wanted} (${entry.slug})` : wanted;
    let attempt = 2;
    while (taken.has(name.toLowerCase())) {
      name = `${wanted} (${entry.slug} ${attempt})`;
      attempt += 1;
    }
    taken.add(name.toLowerCase());
    out.set(entry.slug, name);
  }

  return out;
}
