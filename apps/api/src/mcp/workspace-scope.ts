import { NotFoundException } from '@nestjs/common';

import type { WorkspacesService } from '../workspaces/workspaces.service.js';
import type { McpIdentity } from '../auth/api-key.service.js';

export interface ScopedWorkspace {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
}

/**
 * The workspaces a key may act in.
 *
 * A key belongs to a person, so that is every workspace they are a member of.
 * A key issued under the older per-workspace model carries a workspaceId and is
 * held to it.
 */
export async function reachable(
  workspaces: WorkspacesService,
  identity: McpIdentity,
): Promise<ScopedWorkspace[]> {
  const all = await workspaces.listForUser(identity.userId);
  const visible =
    identity.workspaceId === null
      ? all
      : all.filter((workspace) => workspace.id === identity.workspaceId);

  return visible.map(({ id, slug, name }) => ({ id, slug, name }));
}

/**
 * Which workspace a call means.
 *
 * With one workspace there is nothing to choose, so an agent should not have to
 * say. With several, guessing would be worse than asking: the answer names them.
 */
export async function resolveWorkspace(
  workspaces: WorkspacesService,
  identity: McpIdentity,
  slug: string | undefined,
): Promise<ScopedWorkspace> {
  const options = await reachable(workspaces, identity);
  if (options.length === 0) throw new NotFoundException('This key reaches no workspace');

  if (slug !== undefined && slug !== '') {
    const found = options.find((workspace) => workspace.slug === slug);
    if (found !== undefined) return found;
    throw new NotFoundException(
      `No workspace "${slug}". Reachable: ${options.map((w) => w.slug).join(', ')}`,
    );
  }

  const only = options[0];
  if (options.length === 1 && only !== undefined) return only;

  throw new NotFoundException(
    `Several workspaces are reachable; name one with the workspace argument: ${options
      .map((w) => w.slug)
      .join(', ')}`,
  );
}

export interface NamedFolder {
  readonly id: string;
  readonly name: string;
  /** The folder it sits in; null or absent at the project's top level. */
  readonly parentId?: string | null;
}

export interface ChosenFolder {
  readonly id: string;
  readonly name: string;
  /** Where it is, as an agent writes it: `Specs/Billing`. */
  readonly path: string;
}

/** A path as its parts, without the spaces around each slash or any empty part. */
export function pathParts(given: string): string[] {
  return given
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

/** How a name or a path compares with another: by its parts, case aside. */
function key(given: string): string {
  return pathParts(given).join('/').toLowerCase();
}

/** Every folder with its path from the project's top level. */
export function folderPaths(drawers: readonly NamedFolder[]): ChosenFolder[] {
  const byId = new Map(drawers.map((drawer) => [drawer.id, drawer]));
  const names = (drawer: NamedFolder): string[] => {
    const out = [drawer.name];
    const seen = new Set([drawer.id]);
    let parent = drawer.parentId == null ? undefined : byId.get(drawer.parentId);
    // A parent seen twice is a loop, which must end the walk and not the process.
    while (parent !== undefined && !seen.has(parent.id)) {
      seen.add(parent.id);
      out.unshift(parent.name);
      parent = parent.parentId == null ? undefined : byId.get(parent.parentId);
    }
    return out;
  };
  return drawers.map((drawer) => ({
    id: drawer.id,
    name: drawer.name,
    path: names(drawer).join('/'),
  }));
}

/**
 * Which folder a path, or a bare name, means.
 *
 * Folders are addressed by path here rather than by id, because a folder has no
 * slug and an agent asked to carry an opaque id between calls will sooner or
 * later carry the wrong one. `Specs/Billing` is read from the project's top
 * level down. A bare name, or the tail end of a path, still works when only one
 * folder in the project answers to it, so prompts written before folders
 * nested keep working. Anything that would mean two folders is refused with
 * their paths rather than guessed at.
 *
 * Takes the folders already fetched rather than the service, so the rule can be
 * tested for what it is: which folder a path means, not how the list was got.
 */
export function chooseFolder(drawers: readonly NamedFolder[], given: string): ChosenFolder {
  if (drawers.length === 0) {
    throw new NotFoundException('This project has no folders. Make one with create_folder.');
  }
  const wanted = key(given);
  if (wanted === '') throw new NotFoundException('Name a folder, or give its path.');

  const all = folderPaths(drawers);
  const exact = all.filter((folder) => key(folder.path) === wanted);
  const only = exact[0];
  if (exact.length === 1 && only !== undefined) return only;

  // Only possible for data made before names were unique among siblings.
  if (exact.length > 1) {
    throw new NotFoundException(
      `There are two folders called "${given}" in this project. Rename one of them from the ` +
        'project screen, then try again.',
    );
  }

  // Not a path from the top: a bare name, or the end of a path, that only one
  // folder answers to.
  const tail = all.filter((folder) => key(folder.path).endsWith(`/${wanted}`));
  const one = tail[0];
  if (tail.length === 1 && one !== undefined) return one;
  if (tail.length > 1) {
    throw new NotFoundException(
      `Several folders are called "${given}": ${tail.map((folder) => folder.path).join(', ')}. ` +
        'Give the path of the one you mean.',
    );
  }

  throw new NotFoundException(
    `No folder "${given}". This project has: ${all.map((folder) => folder.path).join(', ')}`,
  );
}
