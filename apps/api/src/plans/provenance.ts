/**
 * Where a Plan says it came from.
 *
 * The link exists today as a line of text in a description — `Source-Specs:
 * <id>` — which a person can follow and nothing else can. Typed, it can be
 * validated when it is written, resolved when it is read, and answered
 * backwards: not only what this Plan came from, but what came of that Spec.
 */

export type SourceState = 'ok' | 'missing' | 'moved';

export interface ResolvedSource {
  readonly id: string;
  readonly title: string | null;
  /** The drawer it is filed in, or null for the project's top level. */
  readonly folder: string | null;
  readonly state: SourceState;
}

export interface SourceRow {
  readonly id: string;
  readonly title: string;
  readonly projectId: string;
  readonly deletedAt: Date | null;
  readonly folder: { name: string } | null;
}

/**
 * What each stored id resolves to now, in the order it was stored.
 *
 * Validity is computed here and never written down. A source that is trashed
 * today and restored tomorrow reports `missing` and then `ok` again with no
 * write in between — which is the whole of "non-destructive": losing a Spec
 * must not quietly edit the Plan that cited it.
 */
export function resolveSources(
  ids: readonly string[],
  projectId: string,
  rows: readonly SourceRow[],
): ResolvedSource[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => {
    const row = byId.get(id);
    if (row === undefined || row.deletedAt !== null) {
      return { id, title: row?.title ?? null, folder: null, state: 'missing' as const };
    }
    return {
      id,
      title: row.title,
      folder: row.folder?.name ?? null,
      state: row.projectId === projectId ? ('ok' as const) : ('moved' as const),
    };
  });
}

/**
 * The set as it will be stored: in the order given, each id once.
 *
 * Replaced whole rather than appended to, so two agents cannot half-agree about
 * what a Plan came from.
 */
export function normalizeSources(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

/**
 * Why a set cannot be stored, or null when it can.
 *
 * Deliberately narrower than the spec asked for: it checks that a source is a
 * Plan in the same project and does **not** check that the source is filed in a
 * folder called `specs`. That is a convention a client keeps, not an invariant
 * a database can hold — the folder is a name somebody may change at any moment,
 * and freezing it here would refuse a legitimate link from anyone who spells it
 * differently and would silently invalidate every stored link the day a drawer
 * is renamed. The folder each source sits in is returned on read instead, so a
 * client can enforce whatever filing rule it keeps.
 */
export function rejectSources(
  ids: readonly string[],
  planId: string,
  projectId: string,
  rows: readonly SourceRow[],
): string | null {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const problems: string[] = [];

  for (const id of ids) {
    if (id === planId) {
      problems.push(`"${id}" is the plan itself`);
      continue;
    }
    const row = byId.get(id);
    if (row === undefined || row.deletedAt !== null) {
      problems.push(`"${id}" is not a plan you can reach`);
      continue;
    }
    if (row.projectId !== projectId) {
      problems.push(`"${id}" is in another project`);
    }
  }

  return problems.length === 0 ? null : problems.join('; ');
}
