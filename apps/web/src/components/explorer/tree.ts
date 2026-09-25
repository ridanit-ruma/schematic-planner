import type { WorkspaceNavigation } from '@/lib/api';

/**
 * The explorer's rules, apart from the component that draws them: what has to
 * be open for a thing to be seen, where a dragged row may land, and which
 * project the buttons at the foot of the tree mean.
 */

export type Nav = WorkspaceNavigation;
export type NavProject = Nav['projects'][number];
export type NavFolder = NavProject['folders'][number];
export type NavPlan = NavProject['plans'][number];

/** The explorer's width: the grip stops at these, and a double-click goes back to the default. */
export const EXPLORER_WIDTH = { min: 200, max: 480, initial: 256 } as const;

export function clampWidth(width: number): number {
  if (!Number.isFinite(width)) return EXPLORER_WIDTH.initial;
  return Math.round(Math.min(EXPLORER_WIDTH.max, Math.max(EXPLORER_WIDTH.min, width)));
}

/** A stored width, or the default when there is none or it is not a number. */
export function readWidth(stored: string | null): number {
  if (stored === null || stored.trim() === '') return EXPLORER_WIDTH.initial;
  const parsed = Number(stored);
  return Number.isFinite(parsed) ? clampWidth(parsed) : EXPLORER_WIDTH.initial;
}

/** The folders directly inside a folder, or at the project's top level for null. */
export function childFolders(project: NavProject, parentId: string | null): NavFolder[] {
  return project.folders.filter((folder) => folder.parentId === parentId);
}

/** The plans filed directly in a folder, or at the project's top level for null. */
export function childPlans(project: NavProject, folderId: string | null): NavPlan[] {
  return project.plans.filter((plan) => plan.folderId === folderId);
}

/**
 * The folders above one, top down, not counting itself. A loop in the data —
 * which the server refuses to make — stops the walk rather than hanging it.
 */
export function foldersAbove(project: NavProject, folderId: string): string[] {
  const above: string[] = [];
  const seen = new Set<string>([folderId]);
  let at = project.folders.find((folder) => folder.id === folderId)?.parentId ?? null;
  while (at !== null && !seen.has(at)) {
    seen.add(at);
    above.unshift(at);
    at = project.folders.find((folder) => folder.id === at)?.parentId ?? null;
  }
  return above;
}

/** Whether `inner` is `outer` or sits anywhere below it. */
export function isWithin(project: NavProject, inner: string, outer: string): boolean {
  return inner === outer || foldersAbove(project, inner).includes(outer);
}

/** The project a plan is filed in, if this tree has it. */
export function projectOfPlan(nav: Nav, planId: string): NavProject | undefined {
  return nav.projects.find((project) => project.plans.some((plan) => plan.id === planId));
}

/**
 * What has to be open for a plan's row to be drawn: its project, then each
 * folder from the top down. Null when the plan is not in this tree.
 */
export function planAncestors(nav: Nav, planId: string): string[] | null {
  const project = projectOfPlan(nav, planId);
  const plan = project?.plans.find((each) => each.id === planId);
  if (project === undefined || plan === undefined) return null;
  return plan.folderId === null
    ? [project.id]
    : [project.id, ...foldersAbove(project, plan.folderId), plan.folderId];
}

/** The same for a folder, including the folder itself, so what it holds is shown. */
export function folderAncestors(project: NavProject, folderId: string): string[] {
  return [project.id, ...foldersAbove(project, folderId), folderId];
}

/** Something being dragged in the tree, and where it is now. */
export type Dragged =
  | { kind: 'plan'; id: string; projectId: string; folderId: string | null }
  | { kind: 'folder'; id: string; projectId: string; parentId: string | null };

/** A place something can be dropped: a project's top level, or a folder in it. */
export interface DropTarget {
  projectId: string;
  folderId: string | null;
}

/**
 * Whether a drop there would do anything, and is allowed.
 *
 * A plan can go anywhere, including another project. A folder stays in its
 * project — the server moves folders only within one — and cannot go inside
 * itself or anything below it. Dropping a thing where it already is is not a
 * move, so it is not offered as one.
 */
export function canDrop(nav: Nav, dragged: Dragged, target: DropTarget): boolean {
  if (dragged.kind === 'plan') {
    return dragged.projectId !== target.projectId || dragged.folderId !== target.folderId;
  }
  if (dragged.projectId !== target.projectId) return false;
  if (dragged.parentId === target.folderId) return false;
  if (target.folderId === null) return true;
  const project = nav.projects.find((each) => each.id === target.projectId);
  if (project === undefined) return false;
  return !isWithin(project, target.folderId, dragged.id);
}

/** One place on offer in a row's "Move to" menu. */
export interface MoveTarget extends DropTarget {
  /** The project's name, then each folder's, top down. */
  path: string[];
}

/**
 * Every place a row's menu can offer to move it to, in tree order: each
 * project's top level followed by its folders. The drag rules decide, so the
 * menu never offers what a drop would refuse.
 */
export function moveTargets(nav: Nav, dragged: Dragged): MoveTarget[] {
  const targets: MoveTarget[] = [];
  for (const project of nav.projects) {
    const visit = (parentId: string | null, path: string[]): void => {
      for (const folder of childFolders(project, parentId)) {
        const here = [...path, folder.name];
        const target = { projectId: project.id, folderId: folder.id };
        if (canDrop(nav, dragged, target)) targets.push({ ...target, path: here });
        // A folder's own subtree is never a destination, so it is not walked.
        if (dragged.kind === 'folder' && folder.id === dragged.id) continue;
        visit(folder.id, here);
      }
    };
    const top = { projectId: project.id, folderId: null };
    if (canDrop(nav, dragged, top)) targets.push({ ...top, path: [project.name] });
    visit(null, [project.name]);
  }
  return targets;
}

/**
 * The project the buttons at the foot of the tree make things in: the one
 * holding the open plan, else the last one used, else the first.
 */
export function currentProject(
  nav: Nav,
  openPlanId: string | undefined,
  lastUsed: string | null,
): NavProject | null {
  if (openPlanId !== undefined) {
    const holding = projectOfPlan(nav, openPlanId);
    if (holding !== undefined) return holding;
  }
  return nav.projects.find((project) => project.id === lastUsed) ?? nav.projects[0] ?? null;
}

/**
 * Where an old list address asked to be taken, carried in the router's state
 * to `/recent` so the explorer can open it and scroll to it.
 */
export interface Reveal {
  workspace?: string;
  /** A project's slug, as the old addresses spelled it. */
  project?: string;
  folder?: string;
}

export function revealState(reveal: Reveal): { reveal: Reveal } {
  return { reveal };
}

export function readReveal(state: unknown): Reveal | null {
  if (typeof state !== 'object' || state === null || !('reveal' in state)) return null;
  const reveal = (state as { reveal: unknown }).reveal;
  if (typeof reveal !== 'object' || reveal === null) return null;
  const pick = (key: string): string | undefined => {
    const value = (reveal as Record<string, unknown>)[key];
    return typeof value === 'string' && value !== '' ? value : undefined;
  };
  const workspace = pick('workspace');
  const project = pick('project');
  const folder = pick('folder');
  return {
    ...(workspace === undefined ? {} : { workspace }),
    ...(project === undefined ? {} : { project }),
    ...(folder === undefined ? {} : { folder }),
  };
}

/** The ids a reveal opens, once the tree it names is loaded. */
export function revealedIds(nav: Nav, reveal: Reveal): { open: string[]; target: string } | null {
  const project = nav.projects.find((each) => each.slug === reveal.project);
  if (project === undefined) return null;
  if (reveal.folder !== undefined && project.folders.some((each) => each.id === reveal.folder)) {
    return { open: folderAncestors(project, reveal.folder), target: reveal.folder };
  }
  return { open: [project.id], target: project.id };
}
