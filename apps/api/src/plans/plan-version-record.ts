import type { PlanDoc } from '@schematic/schema';

import type { PrismaService } from '../common/prisma.service.js';
import type { ChangeActor } from './plan-documents.service.js';

/** How many versions a plan keeps; older ones are dropped as new ones are taken. */
export const VERSIONS_KEPT = 50;

export type VersionReason = 'saved' | 'before-agent' | 'before-restore';

/**
 * Keeps `doc` as a version of its plan and drops whatever falls past the limit.
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
): Promise<string> {
  const { id } = await prisma.planVersion.create({
    data: { planId, userId: actor.userId, apiKeyId: actor.apiKeyId ?? null, reason, label, doc },
    select: { id: true },
  });
  const past = await prisma.planVersion.findMany({
    where: { planId },
    orderBy: { createdAt: 'desc' },
    skip: VERSIONS_KEPT,
    select: { id: true },
  });
  if (past.length > 0) {
    await prisma.planVersion.deleteMany({ where: { id: { in: past.map((one) => one.id) } } });
  }
  return id;
}
