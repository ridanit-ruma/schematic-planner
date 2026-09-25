import { matchVocabulary, type PlanDoc, type PlanOp, type Vocabulary } from '@schematic/schema';

export type VocabularyCheck = { ok: true; ops: PlanOp[] } | { ok: false; message: string };

/**
 * An agent's batch, with every kind and status it names checked against the
 * project the plan is in.
 *
 * The schema takes any string, because projects define their own; this is
 * where a word the project does not have is caught, before anything is
 * written, with the words it does have in the answer. A name is accepted as
 * well as an id — "In review" for `in-review` — and written as the id, which
 * is what nodes store. A value the node already carries is always accepted,
 * archived or unknown, so reading a node and writing it back cannot fail.
 */
export function checkVocabulary(
  ops: readonly PlanOp[],
  doc: Pick<PlanDoc, 'nodes'>,
  vocabulary: Vocabulary,
): VocabularyCheck {
  // What each node carries as the batch goes, so a node made earlier in the
  // same batch is judged by what it was made with.
  const carried = new Map(
    doc.nodes.map((node) => [node.slug, { kind: node.kind, status: node.status }]),
  );
  const problems: string[] = [];
  const checked: PlanOp[] = [];

  for (const op of ops) {
    if (op.op === 'rename_node') {
      const was = carried.get(op.from);
      if (was !== undefined) {
        carried.delete(op.from);
        carried.set(op.to, was);
      }
      checked.push(op);
      continue;
    }
    if (op.op === 'delete_node') carried.delete(op.slug);
    if (op.op !== 'upsert_node') {
      checked.push(op);
      continue;
    }

    const now = carried.get(op.node.slug);
    const node = { ...op.node };

    if (node.kind !== undefined) {
      const found = matchVocabulary(vocabulary.kinds, node.kind, now?.kind, 'kind');
      if (found.ok) node.kind = found.id;
      else problems.push(`${op.node.slug}: ${found.message}`);
    }
    if (node.status !== undefined) {
      const found = matchVocabulary(vocabulary.statuses, node.status, now?.status, 'status');
      if (found.ok) node.status = found.id;
      else problems.push(`${op.node.slug}: ${found.message}`);
    }

    carried.set(node.slug, {
      kind: node.kind ?? now?.kind ?? 'task',
      status: node.status ?? now?.status ?? 'idea',
    });
    checked.push({ ...op, node });
  }

  if (problems.length > 0) {
    return {
      ok: false,
      message: `Nothing was applied.\n${[...new Set(problems)].join('\n')}`,
    };
  }
  return { ok: true, ops: checked };
}
