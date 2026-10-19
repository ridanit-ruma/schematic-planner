import { Injectable, NotFoundException } from '@nestjs/common';
import { planDocFromSnapshot, restoreOps, type PlanDoc } from '@schematic/schema';

import { PrismaService } from '../common/prisma.service.js';
import { AccessService } from '../workspaces/access.service.js';
import { recordVersion, type VersionReason } from './plan-version-record.js';
import { PlansService, type ChangeAuthor } from './plans.service.js';

export interface PlanVersionSummary {
  id: string;
  reason: VersionReason;
  label: string | null;
  at: Date;
  by: ChangeAuthor | null;
  /** How many nodes the plan had then, to tell versions apart at a glance. */
  nodes: number;
}

/**
 * A plan's versions: listed, saved by a person, and restored.
 *
 * Restoring writes the difference through the ordinary write path, so it reaches
 * every open canvas, is in the history like any edit, and is preceded by a
 * version of its own — a restore is never the last word.
 */
@Injectable()
export class PlanVersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly plans: PlansService,
  ) {}

  async list(userId: string, planId: string): Promise<PlanVersionSummary[]> {
    await this.access.requirePlan(userId, planId, 'VIEWER');
    const rows = await this.prisma.planVersion.findMany({
      where: { planId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        reason: true,
        label: true,
        apiKeyId: true,
        createdAt: true,
        doc: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    const agents = await this.plans.agentNames(rows);
    return rows.map((row) => ({
      id: row.id,
      reason: row.reason as VersionReason,
      label: row.label,
      at: row.createdAt,
      by: row.user === null ? null : { ...row.user, agent: agents.get(row.apiKeyId ?? '') ?? null },
      nodes: Array.isArray((row.doc as { nodes?: unknown }).nodes)
        ? (row.doc as { nodes: unknown[] }).nodes.length
        : 0,
    }));
  }

  async save(userId: string, planId: string, label: string | null): Promise<{ id: string }> {
    await this.access.requirePlan(userId, planId, 'EDITOR');
    const id = await recordVersion(
      this.prisma,
      planId,
      await this.plans.current(planId),
      'saved',
      { userId },
      label,
    );
    return { id };
  }

  async restore(userId: string, planId: string, versionId: string): Promise<PlanDoc> {
    await this.access.requirePlan(userId, planId, 'EDITOR');
    const version = await this.prisma.planVersion.findFirst({
      where: { id: versionId, planId },
      select: { doc: true },
    });
    if (version === null) throw new NotFoundException('Version not found');

    const current = await this.plans.current(planId);
    const target = planDocFromSnapshot(version.doc, current);
    await recordVersion(this.prisma, planId, current, 'before-restore', { userId });
    return this.plans.applyOps(userId, planId, restoreOps(current, target), { userId });
  }
}
