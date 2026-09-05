import { Injectable, Logger } from '@nestjs/common';
import { initializePlan, readPlanDoc } from '@schematic/ydoc';
import { emptyPlanDoc, planDocSchema, type PlanDoc } from '@schematic/schema';
import * as Y from 'yjs';

import { PrismaService } from '../common/prisma.service.js';

/**
 * Owns the relationship between the CRDT and the two columns that hold it.
 *
 * `Plan.ydoc` is the write model and `Plan.snapshot` is a projection of it. This
 * is the only place allowed to write either, which is what keeps the projection
 * honest.
 */
@Injectable()
export class PlanDocumentsService {
  private readonly logger = new Logger(PlanDocumentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Load stored state into a freshly created collaborative document. */
  async hydrate(document: Y.Doc, planId: string): Promise<void> {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      select: { id: true, title: true, description: true, ydoc: true, snapshot: true },
    });
    if (plan === null) return;

    if (plan.ydoc !== null && plan.ydoc.length > 0) {
      Y.applyUpdate(document, new Uint8Array(plan.ydoc));
      return;
    }

    // First open: seed the document from the snapshot so a plan created through
    // the REST API or MCP is immediately editable.
    const parsed = planDocSchema.safeParse(plan.snapshot);
    const seed: PlanDoc = parsed.success
      ? parsed.data
      : { ...emptyPlanDoc(plan.id, plan.title), description: plan.description };
    initializePlan(document, seed);
  }

  /** Encode the document and refresh the projection that everything else reads. */
  async persist(planId: string, document: Y.Doc): Promise<void> {
    const state = Buffer.from(Y.encodeStateAsUpdate(document));
    const { doc, dropped } = this.project(planId, document);

    if (dropped.length > 0) {
      this.logger.warn(`plan ${planId}: dropped ${dropped.length} item(s): ${dropped.join('; ')}`);
    }

    await this.prisma.plan.update({
      where: { id: planId },
      data: {
        ydoc: state,
        snapshot: doc,
        title: doc.title,
        description: doc.description,
      },
    });
  }

  project(planId: string, document: Y.Doc): { doc: PlanDoc; dropped: readonly string[] } {
    const result = readPlanDoc(document, { updatedAt: new Date().toISOString() });
    return { doc: { ...result.doc, id: planId }, dropped: result.dropped };
  }
}
