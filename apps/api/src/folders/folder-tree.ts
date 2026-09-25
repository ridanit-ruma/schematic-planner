import type { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../common/prisma.service.js';

/**
 * The shape of a project's folders, as far as nesting is concerned.
 *
 * Every rule about the tree lives here as a function of the rows, not of the
 * database: which folders are in the trash by ancestry, where a folder sits,
 * whether a move would make a loop, whether a name is taken. A project holds a
 * handful of folders, so reading all of them and answering in memory is cheaper
 * than asking Postgres a recursive question, and it can be tested as what it is.
 */
export interface TreeFolder {
  readonly id: string;
  readonly parentId: string | null;
}

export interface NamedTreeFolder extends TreeFolder {
  readonly name: string;
}

export interface TrashableTreeFolder extends TreeFolder {
  readonly deletedAt: Date | null;
}

function byId<T extends TreeFolder>(folders: readonly T[]): Map<string, T> {
  return new Map(folders.map((folder) => [folder.id, folder]));
}

/**
 * The folders above this one, nearest first.
 *
 * Stops at a parent it has already seen, so a loop that somehow reached the
 * database ends the walk rather than the process.
 */
export function ancestorsOf<T extends TreeFolder>(folders: readonly T[], id: string): T[] {
  const index = byId(folders);
  const seen = new Set([id]);
  const out: T[] = [];
  let parentId = index.get(id)?.parentId ?? null;
  while (parentId !== null && !seen.has(parentId)) {
    const parent = index.get(parentId);
    if (parent === undefined) break;
    seen.add(parentId);
    out.push(parent);
    parentId = parent.parentId;
  }
  return out;
}

/** This folder and every folder below it. */
export function subtreeOf(folders: readonly TreeFolder[], id: string): Set<string> {
  const children = new Map<string, string[]>();
  for (const folder of folders) {
    if (folder.parentId === null) continue;
    children.set(folder.parentId, [...(children.get(folder.parentId) ?? []), folder.id]);
  }
  const out = new Set<string>();
  const queue = [id];
  while (queue.length > 0) {
    const next = queue.pop() as string;
    if (out.has(next)) continue;
    out.add(next);
    queue.push(...(children.get(next) ?? []));
  }
  return out;
}

/**
 * Folders that are in the trash: marked themselves, or below one that is.
 *
 * Trashing a folder marks only that folder, the way trashing a project marks
 * only the project, so everything under it has to be found by walking up.
 */
export function trashedFolderIds(folders: readonly TrashableTreeFolder[]): Set<string> {
  const out = new Set<string>();
  for (const folder of folders) {
    if (folder.deletedAt !== null) {
      for (const id of subtreeOf(folders, folder.id)) out.add(id);
    }
  }
  return out;
}

/** Whether this folder is in the trash, by its own mark or an ancestor's. */
export function isTrashed(folders: readonly TrashableTreeFolder[], id: string): boolean {
  const own = folders.find((folder) => folder.id === id);
  if (own === undefined) return false;
  return own.deletedAt !== null || ancestorsOf(folders, id).some((up) => up.deletedAt !== null);
}

/** Names from the project's top level down to this folder, its own last. */
export function pathOf(folders: readonly NamedTreeFolder[], id: string): string[] {
  const own = folders.find((folder) => folder.id === id);
  if (own === undefined) return [];
  return [
    ...ancestorsOf(folders, id)
      .reverse()
      .map((folder) => folder.name),
    own.name,
  ];
}

/**
 * Whether filing `folderId` under `parentId` would put a folder inside itself.
 *
 * Null is the top level, which never makes a loop.
 */
export function wouldLoop(
  folders: readonly TreeFolder[],
  folderId: string,
  parentId: string | null,
): boolean {
  if (parentId === null) return false;
  return subtreeOf(folders, folderId).has(parentId);
}

/** How two names compare for being the same folder: case and outer spaces aside. */
export function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * The sibling that already has this name, if one does.
 *
 * Only folders outside the trash count: a name thrown away is free to use again.
 * `except` is the folder being renamed or moved, which does not clash with itself.
 */
export function siblingNamed<T extends NamedTreeFolder & TrashableTreeFolder>(
  folders: readonly T[],
  parentId: string | null,
  name: string,
  except: string | null = null,
): T | undefined {
  return folders.find(
    (folder) =>
      folder.id !== except &&
      folder.parentId === parentId &&
      folder.deletedAt === null &&
      sameName(folder.name, name),
  );
}

/**
 * The ids of every folder in the trash among the folders `scope` selects,
 * counting those hidden by an ancestor.
 *
 * Asks only for trashed folders first, because on most calls there are none and
 * that is one indexed query; the whole of each affected project is read only
 * when there is a subtree to walk.
 */
export async function hiddenFolderIds(
  prisma: Pick<PrismaService, 'folder'>,
  scope: Prisma.FolderWhereInput,
): Promise<string[]> {
  const marked = await prisma.folder.findMany({
    where: { AND: [scope, { deletedAt: { not: null } }] },
    select: { projectId: true },
  });
  if (marked.length === 0) return [];

  const all = await prisma.folder.findMany({
    where: { projectId: { in: [...new Set(marked.map((folder) => folder.projectId))] } },
    select: { id: true, parentId: true, deletedAt: true },
  });
  return [...trashedFolderIds(all)];
}

/**
 * The part of a plan query that leaves out plans filed in the trash.
 *
 * Spelled with an explicit `folderId: null` branch because `NOT IN` is never
 * true of a null, and a plan at the project's top level is in no folder at all.
 */
export function outsideFolders(hidden: readonly string[]): Prisma.PlanWhereInput {
  if (hidden.length === 0) return {};
  return { OR: [{ folderId: null }, { folderId: { notIn: [...hidden] } }] };
}
