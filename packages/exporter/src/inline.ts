/**
 * Text going into a piece of Markdown the export builds around it.
 *
 * A node body is emitted verbatim, because a body is prose and Markdown is what
 * prose is written in. A title and a comment author are not: they are dropped
 * into the middle of a link, a wikilink label or a blockquote that the export
 * generates, and a `]` or a newline in one of those ends the construct early
 * and leaves the rest of the line as loose text. The result is a malformed
 * vault — a Contents entry that is no longer a link, a `[[target|label]]` that
 * stops at the label, a Notes quote that spills out of its `>`.
 *
 * So these are for scaffolding only. Nothing here is a security measure; the
 * body next to it can say anything, and is meant to.
 */

/** Whitespace flattened, so text meant for one line stays on one line. */
export function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** The visible half of `[text](target)`, where an unescaped bracket ends it. */
export function linkText(text: string): string {
  return oneLine(text).replace(/[[\]]/g, (bracket) => `\\${bracket}`);
}

/**
 * The label half of `[[target|label]]`.
 *
 * Obsidian reads the label literally, so a backslash would be shown rather than
 * escaping anything. The two characters that would end the construct are
 * dropped instead, which is the only option that leaves a working link.
 */
export function wikilinkLabel(text: string): string {
  return oneLine(text).replace(/[[\]|]/g, '');
}
