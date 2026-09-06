import { Injectable } from '@nestjs/common';

import { PrismaService } from '../common/prisma.service.js';
import { AccessService } from '../workspaces/access.service.js';

export interface TrashItem {
  kind: 'plan' | 'project';
  id: string;
  name: string;
  /** Where it was: the project a plan sat in, or how much a project held. */
  where: string;
  deletedAt: Date;
  by: { name: string; avatarUrl: string | null } | null;
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

    const [projects, plans] = await Promise.all([
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
      this.prisma.plan.findMany({
        where: { deletedAt: { not: null }, project: { workspaceId } },
        orderBy: { deletedAt: 'desc' },
        select: {
          id: true,
          title: true,
          deletedAt: true,
          deletedBy: { select: { name: true, avatarUrl: true } },
          project: { select: { name: true } },
        },
      }),
    ]);

    const items: TrashItem[] = [
      ...projects.map((project) => ({
        kind: 'project' as const,
        id: project.id,
        name: project.name,
        where:
          project._count.plans === 1 ? '1 plan inside' : `${project._count.plans} plans inside`,
        deletedAt: project.deletedAt as Date,
        by: project.deletedBy,
      })),
      ...plans.map((plan) => ({
        kind: 'plan' as const,
        id: plan.id,
        name: plan.title === '' ? 'Untitled plan' : plan.title,
        where: plan.project.name,
        deletedAt: plan.deletedAt as Date,
        by: plan.deletedBy,
      })),
    ];

    return items.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
  }

  async restorePlan(userId: string, planId: string): Promise<{ ok: true }> {
    const access = await this.access.requirePlan(userId, planId, 'ADMIN', { includeTrashed: true });

    // Restoring into a project that is itself in the trash would put the plan
    // somewhere nobody can reach, so the project comes back with it.
    await this.prisma.$transaction([
      this.prisma.project.updateMany({
        where: { id: access.projectId, deletedAt: { not: null } },
        data: { deletedAt: null, deletedById: null },
      }),
      this.prisma.plan.update({
        where: { id: planId },
        data: { deletedAt: null, deletedById: null },
      }),
    ]);
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

  async purgeProject(userId: string, projectId: string): Promise<{ ok: true }> {
    await this.access.requireProject(userId, projectId, 'ADMIN', { includeTrashed: true });
    await this.prisma.project.delete({ where: { id: projectId } });
    return { ok: true };
  }

  /** Everything in this workspace's trash, gone. */
  async empty(userId: string, workspaceId: string): Promise<{ removed: number }> {
    await this.access.requireWorkspace(userId, workspaceId, 'ADMIN');

    const [plans, projects] = await this.prisma.$transaction([
      this.prisma.plan.deleteMany({
        where: { deletedAt: { not: null }, project: { workspaceId } },
      }),
      // After the plans, because a project takes its plans with it and the
      // count would then be short.
      this.prisma.project.deleteMany({ where: { workspaceId, deletedAt: { not: null } } }),
    ]);

    return { removed: plans.count + projects.count };
  }
}
