import { emptyPlanDoc } from '@schematic/schema';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../common/prisma.service.js';
import { AGENT_SESSION_MS, VERSIONS_KEPT, recordVersion } from './plan-version-record.js';

interface Row {
  id: string;
  reason: string;
  apiKeyId: string | null;
  createdAt: Date;
}

/** Versions of one plan, newest last, with a clock the test moves. */
function versions() {
  vi.useFakeTimers();
  const rows: Row[] = [];
  const clock = { now: Date.parse('2026-10-20T00:00:00Z') };
  const newestFirst = () => [...rows].reverse();
  const prisma = {
    planVersion: {
      findFirst: async () => newestFirst()[0] ?? null,
      create: async ({ data }: { data: { reason: string; apiKeyId: string | null } }) => {
        const row = { id: `v${rows.length}`, ...data, createdAt: new Date(clock.now) };
        rows.push(row);
        return { id: row.id };
      },
      findMany: async ({ where, skip }: { where: { reason?: { not: string } }; skip: number }) =>
        newestFirst()
          .filter((row) => where.reason === undefined || row.reason !== where.reason.not)
          .slice(skip),
      deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        for (const id of where.id.in)
          rows.splice(
            rows.findIndex((row) => row.id === id),
            1,
          );
      },
    },
  } as unknown as PrismaService;
  const record = (reason: 'saved' | 'before-agent', apiKeyId: string | null = null) => {
    vi.setSystemTime(clock.now);
    return recordVersion(prisma, 'p', emptyPlanDoc('p', 'P'), reason, { userId: 'u', apiKeyId });
  };
  return { rows, clock, record };
}

describe('recordVersion', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps one version for an agent session: the state before its first batch', async () => {
    const { rows, clock, record } = versions();
    expect(await record('before-agent', 'key')).toBe('v0');
    clock.now += AGENT_SESSION_MS / 2;
    expect(await record('before-agent', 'key')).toBeNull();
    expect(await record('before-agent', 'other-key')).toBe('v1');
    clock.now += AGENT_SESSION_MS;
    expect(await record('before-agent', 'other-key')).toBe('v2');
    expect(rows).toHaveLength(3);
  });

  it('never drops a version a person saved to make room', async () => {
    const { rows, clock, record } = versions();
    await record('saved');
    for (let i = 0; i < VERSIONS_KEPT + 5; i += 1) {
      clock.now += AGENT_SESSION_MS;
      await record('before-agent', 'key');
    }
    expect(rows.filter((row) => row.reason === 'saved')).toHaveLength(1);
    expect(rows.filter((row) => row.reason === 'before-agent')).toHaveLength(VERSIONS_KEPT);
  });
});
