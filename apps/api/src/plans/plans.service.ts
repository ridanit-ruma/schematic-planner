import { Injectable, NotFoundException } from '@nestjs/common';
import { exportPlan, exportPlanToZip, type ExportBundle } from '@schematic/exporter';
import { layoutPlan } from '@schematic/layout';
import {
  applyPlanOps,
  emptyPlanDoc,
  normalizeEdge,
  planDocSchema,
  planEdgeInputSchema,
  type PlanDoc,
  type PlanOp,
  type PlanSpec,
} from '@schematic/schema';
import {
  ORIGIN_AGENT,
  ORIGIN_LAYOUT,
  applyOps as applyOpsToDoc,
  commitLayout,
} from '@schematic/ydoc';

import { randomToken } from '../common/crypto.js';
import { PrismaService } from '../common/prisma.service.js';
import { CollabService } from '../collab/collab.service.js';
import { AccessService } from '../workspaces/access.service.js';
import { PlanDocumentsService } from './plan-documents.service.js';
import type { CreatePlanInput, LayoutInput, ShareInput, UpdatePlanInput } from './plans.dto.js';

export interface PlanSummary {
  id: string;
  title: string;
  description: string;
  nodeCount: number;
  updatedAt: Date;
}

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly collab: CollabService,
    private readonly documents: PlanDocumentsService,
  ) {}

  async list(userId: string, workspaceId: string): Promise<PlanSummary[]> {
    await this.access.requireWorkspace(userId, workspaceId, 'VIEWER');
    const plans = await this.prisma.plan.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
    });

    return plans.map((plan) => ({
      id: plan.id,
      title: plan.title,
      description: plan.description,
      nodeCount: planDocSchema.safeParse(plan.snapshot).data?.nodes.length ?? 0,
      updatedAt: plan.updatedAt,
    }));
  }

  async create(userId: string, workspaceId: string, input: CreatePlanInput): Promise<PlanDoc> {
    await this.access.requireWorkspace(userId, workspaceId, 'EDITOR');

    const created = await this.prisma.plan.create({
      data: {
        workspaceId,
        title: input.title,
        description: input.description,
        snapshot: emptyPlanDoc('pending', input.title),
      },
    });

    const seeded = await this.seed(created.id, input);
    await this.prisma.plan.update({
      where: { id: created.id },
      data: { snapshot: seeded, title: seeded.title, description: seeded.description },
    });
    return seeded;
  }

  /**
   * Reads the live document when this instance has it open, and the stored
   * projection otherwise. Without the first case a plan being edited right now
   * would export up to one debounce interval out of date.
   */
  async read(userId: string, planId: string): Promise<PlanDoc> {
    await this.access.requirePlan(userId, planId, 'VIEWER');
    return this.current(planId);
  }

  async update(userId: string, planId: string, input: UpdatePlanInput): Promise<PlanDoc> {
    await this.access.requirePlan(userId, planId, 'EDITOR');

    const ops: PlanOp[] = [
      {
        op: 'set_plan',
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
      },
    ];
    return this.applyOps(userId, planId, ops);
  }

  async remove(userId: string, planId: string): Promise<{ ok: true }> {
    await this.access.requirePlan(userId, planId, 'ADMIN');
    await this.prisma.plan.delete({ where: { id: planId } });
    return { ok: true };
  }

  async applyOps(userId: string, planId: string, ops: readonly PlanOp[]): Promise<PlanDoc> {
    await this.access.requirePlan(userId, planId, 'EDITOR');

    const applied = await this.collab.withDocument(planId, (document) => {
      applyOpsToDoc(document, ops, ORIGIN_AGENT);
      return this.documents.project(planId, document).doc;
    });

    // Agents declare structure and never coordinates, so everything they add
    // arrives unplaced. Placing it here is what keeps that promise: without it a
    // batch of new nodes piles up on the origin until somebody presses Arrange.
    if (!applied.nodes.some((node) => node.position === null)) return applied;

    const { positions, sizes } = await layoutPlan(applied, { scope: 'unpinned' });
    return this.collab.withDocument(planId, (document) => {
      commitLayout(document, positions, ORIGIN_LAYOUT, sizes);
      return this.documents.project(planId, document).doc;
    });
  }

  async layout(userId: string, planId: string, input: LayoutInput): Promise<PlanDoc> {
    await this.access.requirePlan(userId, planId, 'EDITOR');

    const doc = await this.current(planId);
    const { positions, sizes } = await layoutPlan(doc, {
      direction: input.direction,
      scope: input.scope,
    });

    return this.collab.withDocument(planId, (document) => {
      commitLayout(document, positions, ORIGIN_AGENT, sizes);
      return this.documents.project(planId, document).doc;
    });
  }

  async exportBundle(userId: string, planId: string): Promise<ExportBundle> {
    await this.access.requirePlan(userId, planId, 'VIEWER');
    return exportPlan(await this.current(planId));
  }

  async exportZip(userId: string, planId: string): Promise<{ doc: PlanDoc; zip: Uint8Array }> {
    await this.access.requirePlan(userId, planId, 'VIEWER');
    const doc = await this.current(planId);
    return { doc, zip: await exportPlanToZip(doc) };
  }

  async share(userId: string, planId: string, input: ShareInput) {
    await this.access.requirePlan(userId, planId, 'EDITOR');

    // Stored as issued rather than hashed: unlike a session token this one has
    // to be shown again whenever someone reopens the share dialog, and it grants
    // read-only access to a plan its holder was deliberately given.
    const token = randomToken(18);
    await this.prisma.planShare.upsert({
      where: { planId },
      create: {
        planId,
        token,
        ...(input.expiresInDays !== undefined && {
          expiresAt: new Date(Date.now() + input.expiresInDays * 86_400_000),
        }),
      },
      update: {
        token,
        expiresAt:
          input.expiresInDays === undefined
            ? null
            : new Date(Date.now() + input.expiresInDays * 86_400_000),
      },
    });

    return { token };
  }

  async unshare(userId: string, planId: string) {
    await this.access.requirePlan(userId, planId, 'EDITOR');
    await this.prisma.planShare.deleteMany({ where: { planId } });
    return { ok: true };
  }

  /** Read-only access for anyone holding the link. No session required. */
  async readShared(token: string): Promise<PlanDoc> {
    const share = await this.prisma.planShare.findUnique({ where: { token } });
    if (share === null) throw new NotFoundException('That link is not valid');
    if (share.expiresAt !== null && share.expiresAt.getTime() < Date.now()) {
      throw new NotFoundException('That link has expired');
    }
    return this.current(share.planId);
  }

  async current(planId: string): Promise<PlanDoc> {
    const live = this.collab.loaded(planId);
    if (live !== undefined) return this.documents.project(planId, live).doc;

    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (plan === null) throw new NotFoundException('Plan not found');

    const parsed = planDocSchema.safeParse(plan.snapshot);
    if (parsed.success) return { ...parsed.data, id: plan.id, updatedAt: plan.updatedAt.toISOString() };

    return { ...emptyPlanDoc(plan.id, plan.title), description: plan.description };
  }

  /** Builds the first version of a plan, laying out anything the caller left unplaced. */
  private async seed(planId: string, input: CreatePlanInput): Promise<PlanDoc> {
    const base: PlanDoc = {
      ...emptyPlanDoc(planId, input.title),
      description: input.description,
      updatedAt: new Date().toISOString(),
    };
    if (input.spec === undefined) return base;

    const withStructure = this.fromSpec(base, input.spec);
    const { positions, sizes } = await layoutPlan(withStructure, { scope: 'unpinned' });

    return {
      ...withStructure,
      nodes: withStructure.nodes.map((node) => ({
        ...node,
        ...(positions.get(node.slug) !== undefined && { position: positions.get(node.slug) ?? null }),
        ...(sizes.get(node.slug) !== undefined && { size: sizes.get(node.slug) ?? null }),
      })),
    };
  }

  private fromSpec(base: PlanDoc, spec: PlanSpec): PlanDoc {
    const ops: PlanOp[] = [
      ...spec.nodes.map((node) => ({ op: 'upsert_node' as const, node })),
      ...spec.edges
        .map((edge) => planEdgeInputSchema.parse(edge))
        .map((edge) => ({ op: 'upsert_edge' as const, edge: normalizeEdge(edge) })),
    ];
    const withMeta = { ...base, title: spec.title, description: spec.description };
    return ops.length === 0 ? withMeta : applyPlanOps(withMeta, ops);
  }
}
