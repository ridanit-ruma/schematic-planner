import type { PlanDoc } from '@schematic/schema';

import type { PrismaService } from '../common/prisma.service.js';
import type { ChangeActor } from './plan-documents.service.js';

/**
 * How many automatic versions a plan keeps; older ones are dropped as new ones
 * are taken. A version a person saved is never dropped this way.
 */
export const VERSIONS_KEPT = 50;

/**
 * How long one agent's batches count as one session: a batch within this long
 * of that agent's last version takes none of its own, so the version before
 * the session's first batch is the one kept — the state to go back to when the
 * whole session is to be undone.
 */
export const AGENT_SESSION_MS = 10 * 60 * 1000;

export type VersionReason = 'saved' | 'before-agent' | 'before-restore';

/**
 * Keeps `doc` as a version of its plan and drops the automatic versions past
 * the limit. Returns null when an agent's batch falls inside a session that
 * already has its version.
 *
 * A plain function rather than a method so the write path can take one before an
 * agent's batch without the two services depending on each other.
 */
export async function recordVersion(
  prisma: PrismaService,
  planId: string,
  doc: PlanDoc,
  reason: VersionReason,
  actor: Pick<ChangeActor, 'userId' | 'apiKeyId'>,
  label: string | null = null,
): Promise<string | null> {
  if (reason === 'before-agent') {
    const last = await prisma.planVersion.findFirst({
      where: { planId },
      orderBy: { createdAt: 'desc' },
      select: { reason: true, apiKeyId: true, createdAt: true },
    });
    const sameSession =
      last !== null &&
      last.reason === 'before-agent' &&
      last.apiKeyId === (actor.apiKeyId ?? null) &&
      Date.now() - last.createdAt.getTime() < AGENT_SESSION_MS;
    if (sameSession) return null;
  }
  const { id } = await prisma.planVersion.create({
    data: {
      planId,
      userId: actor.userId,
      apiKeyId: actor.apiKeyId ?? null,
      reason,
      label,
      doc,
      nodeCount: doc.nodes.length,
    },
    select: { id: true },
  });
  const past = await prisma.planVersion.findMany({
    where: { planId, reason: { not: 'saved' } },
    orderBy: { createdAt: 'desc' },
    skip: VERSIONS_KEPT,
    select: { id: true },
  });
  if (past.length > 0) {
    await prisma.planVersion.deleteMany({ where: { id: { in: past.map((one) => one.id) } } });
  }
  return id;
}
