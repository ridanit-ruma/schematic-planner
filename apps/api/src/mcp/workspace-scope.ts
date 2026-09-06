import { NotFoundException } from '@nestjs/common';

import type { WorkspacesService } from '../workspaces/workspaces.service.js';
import type { McpIdentity } from './api-key.service.js';

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
