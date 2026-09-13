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
}

/**
 * Which folder a name means.
 *
 * Folders are addressed by name here rather than by id, because a folder has no
 * slug and an agent asked to carry an opaque id between calls will sooner or
 * later carry the wrong one. The cost is that two folders of one name are
 * ambiguous — which is why create_folder returns the folder that is already
 * there rather than making a second.
 *
 * Takes the folders already fetched rather than the service, so the rule can be
 * tested for what it is: which folder a name means, not how the list was got.
 */
export function chooseFolder(drawers: readonly NamedFolder[], name: string): NamedFolder {
  if (drawers.length === 0) {
    throw new NotFoundException('This project has no folders. Make one with create_folder.');
  }

  const wanted = name.trim().toLowerCase();
  const found = drawers.filter((drawer) => drawer.name.trim().toLowerCase() === wanted);

  const only = found[0];
  if (found.length === 1 && only !== undefined) return only;

  if (found.length > 1) {
    throw new NotFoundException(
      `There are two folders called "${name}" in this project. Rename one of them from the ` +
        'project screen, then try again.',
    );
  }

  throw new NotFoundException(
    `No folder "${name}". This project has: ${drawers.map((drawer) => drawer.name).join(', ')}`,
  );
}
