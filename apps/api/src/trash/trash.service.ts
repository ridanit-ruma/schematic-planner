import { Injectable } from '@nestjs/common';

import { PrismaService } from '../common/prisma.service.js';
import {
  ancestorsOf,
  hiddenFolderIds,
  lockFolderTrees,
  pathOf,
  subtreeOf,
} from '../folders/folder-tree.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AccessService } from '../workspaces/access.service.js';

export interface TrashItem {
  kind: 'plan' | 'project' | 'folder';
  id: string;
  name: string;
  /** Where it was: the project a plan sat in, or how much a project held. */
  where: string;
  /**
   * Where it sat, for a plan or a folder: the project's name and the folders
   * above it from the top down. Null for a project.
   */
  location: { project: string; folders: string[] } | null;
  deletedAt: Date;
  by: { name: string; avatarUrl: string | null } | null;
  /**
   * The plan is still answering a public share link. Trashing does not drop the
   * share -- the trash is reversible, and a fresh token would not be the link
   * people already have -- so this screen is where it can be turned off.
   */
  shared: boolean;
}

/**
 * What has been thrown away, and the two ways out of it.
 *
 * Deleting is the one action in the product that destroys work somebody else
 * may still want, so it does not destroy anything: it sets `deletedAt` and
 * every listing stops looking. Emptying the trash is the act that actually
 * removes rows, and it is separate, named, and asked for on purpose.
 */
@Injectable()
export class TrashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async list(userId: string, workspaceId: string): Promise<TrashItem[]> {
    await this.access.requireWorkspace(userId, workspaceId, 'ADMIN');

    const [projects, folders, plans, tree] = await Promise.all([
      this.prisma.project.findMany({
        where: { workspaceId, deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' },
        select: {
          id: true,
          name: true,
          deletedAt: true,
          deletedBy: { select: { name: true, avatarUrl: true } },
          _count: { select: { plans: true } },
        },
      }),
      this.prisma.folder.findMany({
        where: { deletedAt: { not: null }, project: { workspaceId } },
        orderBy: { deletedAt: 'desc' },
        select: {
          id: true,
          name: true,
          deletedAt: true,
          deletedBy: { select: { name: true, avatarUrl: true } },
          project: { select: { name: true } },
        },
      }),
      this.prisma.plan.findMany({
        where: { deletedAt: { not: null }, project: { workspaceId } },
        orderBy: { deletedAt: 'desc' },
        select: {
          id: true,
          title: true,
          folderId: true,
          deletedAt: true,
          deletedBy: { select: { name: true, avatarUrl: true } },
          project: { select: { name: true } },
          share: { select: { id: true } },
        },
      }),
      // Every folder of the workspace, to say where each thing sat and what a
      // folder took with it. Names and links only; a workspace holds few.
      this.prisma.folder.findMany({
        where: { project: { workspaceId } },
        select: {
          id: true,
          parentId: true,
          name: true,
          plans: { where: { deletedAt: null }, select: { id: true } },
        },
      }),
    ]);

    const above = (folderId: string): string[] =>
      ancestorsOf(tree, folderId)
        .reverse()
        .map((folder) => folder.name);
    // Plans filed anywhere below a folder go to the trash with it, so they are
    // what it holds — not only the ones filed in it directly.
    const held = (folderId: string): number =>
      [...subtreeOf(tree, folderId)].reduce(
        (sum, id) => sum + (tree.find((folder) => folder.id === id)?.plans.length ?? 0),
        0,
      );
    const place = (project: string, path: readonly string[]): string =>
      [project, ...path].join(' / ');

    const items: TrashItem[] = [
      ...projects.map((project) => ({
        kind: 'project' as const,
        id: project.id,
        name: project.name,
        where:
          project._count.plans === 1 ? '1 plan inside' : `${project._count.plans} plans inside`,
        location: null,
        deletedAt: project.deletedAt as Date,
        by: project.deletedBy,
        shared: false,
      })),
      ...folders.map((folder) => {
        const count = held(folder.id);
        const path = above(folder.id);
        return {
          kind: 'folder' as const,
          id: folder.id,
          name: folder.name,
          where:
            count === 1
              ? `1 plan inside, in ${place(folder.project.name, path)}`
              : `${count} plans inside, in ${place(folder.project.name, path)}`,
          location: { project: folder.project.name, folders: path },
          deletedAt: folder.deletedAt as Date,
          by: folder.deletedBy,
          shared: false,
        };
      }),
      ...plans.map((plan) => {
        const path = plan.folderId === null ? [] : pathOf(tree, plan.folderId);
        return {
          kind: 'plan' as const,
          id: plan.id,
          name: plan.title === '' ? 'Untitled plan' : plan.title,
          where: place(plan.project.name, path),
          location: { project: plan.project.name, folders: path },
          deletedAt: plan.deletedAt as Date,
          by: plan.deletedBy,
          shared: plan.share !== null,
        };
      }),
    ];

    return items.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
  }

  async restorePlan(userId: string, planId: string): Promise<{ ok: true }> {
    const access = await this.access.requirePlan(userId, planId, 'ADMIN', { includeTrashed: true });
    // Under the tree's lock, so emptying the trash cannot delete a folder this
    // brings back between reading the tree and writing it.
    await this.prisma.$transaction(async (tx) => {
      await lockFolderTrees(tx, [access.projectId]);
      const plan = await tx.plan.findUniqueOrThrow({
        where: { id: planId },
        select: { folderId: true },
      });

      // Restoring into a project or folder that is itself in the trash would put
      // the plan somewhere nobody can reach, so its containers come back with it.
      const folders =
        plan.folderId === null ? [] : await chain(tx, access.projectId, plan.folderId);
      await tx.project.updateMany({
        where: { id: access.projectId, deletedAt: { not: null } },
        data: { deletedAt: null, deletedById: null },
      });
      await tx.folder.updateMany({
        where: { id: { in: folders }, deletedAt: { not: null } },
        data: { deletedAt: null, deletedById: null },
      });
      await tx.plan.update({
        where: { id: planId },
        data: { deletedAt: null, deletedById: null },
      });
    });
    return { ok: true };
  }

  /**
   * Clears the folder's own mark, which brings back everything below it that
   * had no mark of its own. The folders above it come back too, for the same
   * reason a plan's do.
   */
  async restoreFolder(userId: string, folderId: string): Promise<{ ok: true }> {
    const access = await this.access.requireFolder(userId, folderId, 'ADMIN', {
      includeTrashed: true,
    });
    await this.prisma.$transaction(async (tx) => {
      await lockFolderTrees(tx, [access.projectId]);
      const folders = await chain(tx, access.projectId, folderId);
      await tx.project.updateMany({
        where: { id: access.projectId, deletedAt: { not: null } },
        data: { deletedAt: null, deletedById: null },
      });
      await tx.folder.updateMany({
        where: { id: { in: folders }, deletedAt: { not: null } },
        data: { deletedAt: null, deletedById: null },
      });
    });
    return { ok: true };
  }

  async restoreProject(userId: string, projectId: string): Promise<{ ok: true }> {
    await this.access.requireProject(userId, projectId, 'ADMIN', { includeTrashed: true });
    await this.prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: null, deletedById: null },
    });
    return { ok: true };
  }

  async purgePlan(userId: string, planId: string): Promise<{ ok: true }> {
    await this.access.requirePlan(userId, planId, 'ADMIN', { includeTrashed: true });
    await this.prisma.plan.delete({ where: { id: planId } });
    return { ok: true };
  }

  /**
   * The folder goes, and the folders below it with it; the plans that were in
   * them do not. `onDelete: SetNull` puts them back at the project's top level,
   * which is the one place they are certain to be reachable.
   */
  async purgeFolder(userId: string, folderId: string): Promise<{ ok: true }> {
    await this.access.requireFolder(userId, folderId, 'ADMIN', { includeTrashed: true });
    await this.prisma.folder.delete({ where: { id: folderId } });
    return { ok: true };
  }

  async purgeProject(userId: string, projectId: string): Promise<{ ok: true }> {
    await this.access.requireProject(userId, projectId, 'ADMIN', { includeTrashed: true });
    await this.prisma.project.delete({ where: { id: projectId } });
    return { ok: true };
  }

  /** Everything in this workspace's trash, gone. */
  async empty(userId: string, workspaceId: string): Promise<{ removed: number }> {
    await this.access.requireWorkspace(userId, workspaceId, 'ADMIN');
    // Read inside the transaction that deletes, under the lock a restore takes,
    // so a folder restored first is not deleted from a stale reading.
    const [plans, folders, projects] = await this.prisma.$transaction(async (tx) => {
      const all = await tx.project.findMany({ where: { workspaceId }, select: { id: true } });
      await lockFolderTrees(
        tx,
        all.map((project) => project.id),
      );
      // Everything below a discarded folder, as well as the folder itself.
      const hidden = await hiddenFolderIds(tx, { project: { workspaceId } });

      return [
        // Plans filed in a discarded folder go with it: they were thrown away
        // when it was, and only the folder carries the mark.
        await tx.plan.deleteMany({
          where: {
            project: { workspaceId },
            OR: [{ deletedAt: { not: null } }, { folderId: { in: hidden } }],
          },
        }),
        await tx.folder.deleteMany({
          where: { id: { in: hidden }, project: { workspaceId } },
        }),
        // After the plans, because a project takes its plans with it and the
        // count would then be short.
        await tx.project.deleteMany({ where: { workspaceId, deletedAt: { not: null } } }),
      ];
    });

    return { removed: plans.count + folders.count + projects.count };
  }
}

/** A folder and every folder above it. */
async function chain(
  tx: Prisma.TransactionClient,
  projectId: string,
  folderId: string,
): Promise<string[]> {
  const folders = await tx.folder.findMany({
    where: { projectId },
    select: { id: true, parentId: true },
  });
  return [folderId, ...ancestorsOf(folders, folderId).map((folder) => folder.id)];
}
