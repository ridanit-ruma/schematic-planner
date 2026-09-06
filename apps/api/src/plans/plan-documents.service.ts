import { Injectable, Logger } from '@nestjs/common';
import { initializePlan, readPlanDoc } from '@schematic/ydoc';
import { diffPlans, emptyPlanDoc, planDocSchema, type PlanDoc } from '@schematic/schema';
import * as Y from 'yjs';

import { PrismaService } from '../common/prisma.service.js';

/** Who a change is recorded against. */
export interface ChangeActor {
  readonly userId: string;
  /** Set when the change arrived over MCP, so the log can say an agent made it. */
  readonly apiKeyId?: string | null;
}

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

  /**
   * The version each plan's history has been written up to, and who is writing
   * now. Storing is debounced, so without these two a burst of edits from two
   * people would be recorded as one batch with no way to say who did what.
   */
  private readonly recorded = new Map<string, PlanDoc>();
  private readonly writing = new Map<string, ChangeActor>();

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

  /**
   * Note who is editing, before they edit. A different person taking over
   * closes the previous one's entry first, so a shared window is never
   * attributed to whoever happened to trigger the save.
   */
  async noteActor(planId: string, actor: ChangeActor, document: Y.Doc): Promise<void> {
    const current = this.writing.get(planId);
    if (current !== undefined && !sameActor(current, actor)) {
      await this.record(planId, document);
    }
    this.writing.set(planId, actor);
    if (!this.recorded.has(planId)) this.recorded.set(planId, this.project(planId, document).doc);
  }

  /** Write the history since the last entry, against whoever has been editing. */
  async record(planId: string, document: Y.Doc): Promise<void> {
    const actor = this.writing.get(planId);
    const before = this.recorded.get(planId);
    const after = this.project(planId, document).doc;
    this.recorded.set(planId, after);
    if (actor === undefined || before === undefined) return;

    const entries = diffPlans(before, after);
    if (entries.length === 0) return;

    await this.prisma.planChange.createMany({
      data: entries.map((entry) => ({
        planId,
        userId: actor.userId,
        apiKeyId: actor.apiKeyId ?? null,
        kind: entry.kind,
        subject: entry.subject,
        label: entry.label,
        detail: entry.detail,
      })),
    });
  }

  /** Nothing to attribute once the last person editing has gone. */
  forget(planId: string): void {
    this.recorded.delete(planId);
    this.writing.delete(planId);
  }

  /** Encode the document and refresh the projection that everything else reads. */
  async persist(planId: string, document: Y.Doc): Promise<void> {
    await this.record(planId, document);
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

function sameActor(a: ChangeActor, b: ChangeActor): boolean {
  return a.userId === b.userId && (a.apiKeyId ?? null) === (b.apiKeyId ?? null);
}
