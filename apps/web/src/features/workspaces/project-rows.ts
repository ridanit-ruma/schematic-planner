import type { FolderSummary, PlanSummary } from '@/lib/api';

/**
 * One line of a project's index: a drawer, or a sheet lying outside them all.
 *
 * A folder used to be a heading with the plans inside it listed underneath, so
 * the screen showed a project's whole contents at once and a folder was a label
 * rather than a place. It is a row now, and going into it is how you see what is
 * in it — which is what the rail beside the canvas has always done.
 */
export type ProjectRow =
  | { kind: 'folder'; folder: FolderSummary }
  | { kind: 'plan'; plan: PlanSummary };

/**
 * Top-level folders first, then the plans filed in none of them. A folder
 * inside another is reached through its parent, not listed beside it.
 *
 * Order inside each group is the server's: folders by name, plans by how
 * recently they changed. Neither is re-sorted here — a list that quietly
 * disagrees with every other listing of the same things is worse than one that
 * is sorted the way you did not expect.
 */
export function projectRows(
  folders: readonly FolderSummary[],
  plans: readonly PlanSummary[],
): ProjectRow[] {
  return [
    ...folders
      .filter((folder) => folder.parentId === null)
      .map((folder): ProjectRow => ({ kind: 'folder', folder })),
    ...plans
      .filter((plan) => plan.folderId === null)
      .map((plan): ProjectRow => ({ kind: 'plan', plan })),
  ];
}

/** The plans filed in one drawer. */
export function folderPlans(plans: readonly PlanSummary[], folderId: string): PlanSummary[] {
  return plans.filter((plan) => plan.folderId === folderId);
}
