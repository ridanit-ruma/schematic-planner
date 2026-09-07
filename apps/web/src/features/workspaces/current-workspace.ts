/**
 * Which workspace the rail is showing.
 *
 * Most screens name one in the address, but the account screens and the recent
 * list do not belong to a workspace at all — and falling back to the first in
 * the list meant opening your profile silently moved you to somebody else's
 * workspace, with the rail's rows now pointing at it. So the last one actually
 * visited is remembered, and it is what those screens keep showing.
 */
const KEY = 'workspace-last';

export function rememberedWorkspace(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function rememberWorkspace(slug: string): void {
  try {
    window.localStorage.setItem(KEY, slug);
  } catch {
    /* A remembered place is a convenience, not a requirement. */
  }
}

/**
 * The address wins; then where you last were; then the first workspace, for an
 * account that has never opened one. A remembered workspace you have since left
 * is not a workspace, so it falls through.
 */
export function resolveWorkspace<T extends { slug: string }>(
  all: readonly T[],
  routeSlug: string | undefined,
  remembered: string | null,
): T | undefined {
  return (
    (routeSlug === undefined ? undefined : all.find((workspace) => workspace.slug === routeSlug)) ??
    (remembered === null
      ? undefined
      : all.find((workspace) => workspace.slug === remembered)) ??
    all[0]
  );
}
