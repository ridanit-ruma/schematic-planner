import type { PlanNode } from './plan.js';
import { isWorkKind, statusOf, type Vocabulary, type VocabularyStatus } from './vocabulary.js';

export interface BoardColumn {
  /** Null for the column of nodes whose status the project does not define. */
  status: VocabularyStatus | null;
  nodes: PlanNode[];
}

/**
 * A plan as columns of work, one per status, in the order the project lists them.
 *
 * Only work is on the board — the rule `next_task` uses — so notes and groups,
 * which have no progress to make, stay off it. Every piece of work is on it:
 * an archived status keeps its column while a node still has it, and a status
 * the project never defined gets a trailing column rather than hiding the node.
 */
export function boardColumns(nodes: readonly PlanNode[], vocabulary: Vocabulary): BoardColumn[] {
  const work = nodes.filter((node) => isWorkKind(vocabulary, node.kind));
  const columns: BoardColumn[] = vocabulary.statuses
    .map((status) => ({ status, nodes: work.filter((node) => node.status === status.id) }))
    .filter((column) => !column.status.archived || column.nodes.length > 0);
  const unknown = work.filter((node) => statusOf(vocabulary, node.status) === undefined);
  if (unknown.length > 0) columns.push({ status: null, nodes: unknown });
  return columns;
}
