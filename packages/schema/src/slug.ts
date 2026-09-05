export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX_LENGTH = 64;

const FALLBACK_SLUG = 'node';

/**
 * Slugs are the identity an agent uses to talk about a node, so they are ASCII
 * only and stable. A title with no ASCII letters or digits (a Korean title, for
 * instance) has nothing to derive from and falls back to `node`; `uniqueSlug`
 * then makes it distinct.
 */
export function slugify(input: string): string {
  const slug = input
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');

  return slug === '' ? FALLBACK_SLUG : slug;
}

export function isSlug(value: string): boolean {
  return value.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(value);
}

export function uniqueSlug(input: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = slugify(input);
  if (!used.has(base)) return base;

  for (let n = 2; ; n += 1) {
    const suffix = `-${n}`;
    const head = base.slice(0, SLUG_MAX_LENGTH - suffix.length).replace(/-+$/g, '');
    const candidate = `${head === '' ? FALLBACK_SLUG : head}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}
