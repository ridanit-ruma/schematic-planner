import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { hashToken } from '../common/crypto.js';
import type { PrismaService } from '../common/prisma.service.js';
import type { AppConfig } from '../config/env.js';
import { AuthService, ROTATION_GRACE_MS, refreshVerdict } from './auth.service.js';

/**
 * Refresh-token rotation, against an in-memory session table.
 *
 * Rotation used to delete the presented session outright, so a successor lost
 * on the way back — the page unloaded mid-request, a connection dropped — left
 * the browser holding a cookie nothing would take, and the person was signed
 * out for having been unlucky once. What is pinned here is the grace that
 * replaced that, and that it stays narrow.
 */

interface Row {
  id: string;
  userId: string;
  tokenHash: string;
  userAgent: string | null;
  expiresAt: Date;
  createdAt: Date;
  replacedAt: Date | null;
  replacedById: string | null;
}

type Where = Record<string, unknown>;

function matches(row: Row, where: Where): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (key === 'OR') return (expected as Where[]).some((branch) => matches(row, branch));
    const actual = row[key as keyof Row];
    if (expected !== null && typeof expected === 'object' && 'lt' in expected) {
      return actual instanceof Date && actual.getTime() < (expected.lt as Date).getTime();
    }
    if (expected instanceof Date)
      return actual instanceof Date && actual.getTime() === expected.getTime();
    return actual === expected;
  });
}

const USER = {
  id: 'user-1',
  email: 'ruma@example.com',
  name: 'Ruma',
  avatarUrl: null,
  instanceRole: 'OWNER' as const,
  suspendedAt: null as Date | null,
};

function fakePrisma() {
  const rows: Row[] = [];
  let next = 0;
  const session = {
    findUnique: async ({ where, include }: { where: Where; include?: { user: true } }) => {
      const row = rows.find((candidate) => matches(candidate, where));
      if (row === undefined) return null;
      return include?.user === true ? { ...row, user: USER } : { ...row };
    },
    create: async ({ data }: { data: Partial<Row> }) => {
      next += 1;
      const row: Row = {
        id: `s${next}`,
        userId: data.userId ?? '',
        tokenHash: data.tokenHash ?? '',
        userAgent: data.userAgent ?? null,
        expiresAt: data.expiresAt ?? new Date(),
        createdAt: new Date(),
        replacedAt: null,
        replacedById: null,
      };
      rows.push(row);
      return { ...row };
    },
    updateMany: async ({ where, data }: { where: Where; data: Partial<Row> }) => {
      const hit = rows.filter((row) => matches(row, where));
      for (const row of hit) Object.assign(row, data);
      return { count: hit.length };
    },
    deleteMany: async ({ where }: { where: Where }) => {
      const before = rows.length;
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (matches(rows[index]!, where)) rows.splice(index, 1);
      }
      return { count: before - rows.length };
    },
  };
  return { rows, prisma: { session } as unknown as PrismaService };
}

function service() {
  const { rows, prisma } = fakePrisma();
  const jwt = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '15m' } });
  const config = { refreshTokenTtl: '30d' } as unknown as AppConfig;
  const auth = new AuthService(prisma, jwt, config);
  /** A session as sign-in leaves it, with the token the browser would hold. */
  const signIn = async (): Promise<string> => {
    const { refreshToken } = await (
      auth as unknown as {
        issue: (user: typeof USER) => Promise<{ refreshToken: string }>;
      }
    ).issue(USER);
    return refreshToken;
  };
  const live = () => rows.filter((row) => row.replacedAt === null);
  return { auth, rows, live, signIn };
}

describe('refreshing a session', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T10:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rotates: the token is replaced by a new one, and exactly one session is live', async () => {
    const { auth, rows, live, signIn } = service();
    const first = await signIn();

    const result = await auth.refresh(first);

    expect(result.refreshToken).not.toBe(first);
    expect(result.accessToken).toMatch(/^ey/);
    expect(live().map((row) => row.tokenHash)).toEqual([hashToken(result.refreshToken)]);
    const old = rows.find((row) => row.tokenHash === hashToken(first));
    expect(old?.replacedById).toBe(result.sessionId);
  });

  it('keeps rotating along the chain, and clears replaced tokens once their window has passed', async () => {
    const { auth, rows, signIn } = service();
    let token = await signIn();
    for (let round = 0; round < 3; round += 1) {
      vi.advanceTimersByTime(ROTATION_GRACE_MS + 1_000);
      token = (await auth.refresh(token)).refreshToken;
    }
    // The current session and the one it replaced a moment ago; nothing older.
    expect(rows).toHaveLength(2);
  });

  it('answers a replay inside the window with a new successor, when the first never arrived', async () => {
    const { auth, rows, live, signIn } = service();
    const first = await signIn();
    const lost = await auth.refresh(first);

    vi.advanceTimersByTime(ROTATION_GRACE_MS - 1_000);
    const again = await auth.refresh(first);

    expect(again.refreshToken).not.toBe(lost.refreshToken);
    // The successor nobody received is gone, so it cannot linger as a device.
    expect(live().map((row) => row.id)).toEqual([again.sessionId]);
    expect(rows.some((row) => row.id === lost.sessionId)).toBe(false);
    // And the chain carries on from the new one.
    await expect(auth.refresh(again.refreshToken)).resolves.toMatchObject({
      user: { id: USER.id },
    });
  });

  it('refuses a replay after the window, and forgets the token', async () => {
    const { auth, rows, signIn } = service();
    const first = await signIn();
    const kept = await auth.refresh(first);

    vi.advanceTimersByTime(ROTATION_GRACE_MS + 1_000);

    await expect(auth.refresh(first)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(rows.some((row) => row.tokenHash === hashToken(first))).toBe(false);
    // The session that did arrive is untouched.
    await expect(auth.refresh(kept.refreshToken)).resolves.toBeDefined();
  });

  it('refuses a replay inside the window once the successor has been used', async () => {
    const { auth, signIn } = service();
    const first = await signIn();
    const second = await auth.refresh(first);
    await auth.refresh(second.refreshToken);

    await expect(auth.refresh(first)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuses a token it has never issued', async () => {
    const { auth } = service();
    await expect(auth.refresh('not-a-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('signing out with a token whose successor never arrived ends both', async () => {
    const { auth, rows, signIn } = service();
    const first = await signIn();
    await auth.refresh(first);

    await auth.logout(first);

    expect(rows).toHaveLength(0);
  });
});

describe('refreshVerdict', () => {
  const now = Date.parse('2026-09-26T10:00:00.000Z');
  const later = new Date(now + 60_000);

  it('rotates a token that has not been replaced', () => {
    expect(refreshVerdict({ expiresAt: later, replacedAt: null }, null, now)).toBe('rotate');
  });

  it('refuses an expired token, replaced or not', () => {
    const past = new Date(now - 1);
    expect(refreshVerdict({ expiresAt: past, replacedAt: null }, null, now)).toBe('refuse');
    expect(
      refreshVerdict({ expiresAt: past, replacedAt: new Date(now) }, { replacedAt: null }, now),
    ).toBe('refuse');
  });

  it('replays only inside the window, and only while the successor is unused', () => {
    const replacedAt = new Date(now - ROTATION_GRACE_MS);
    expect(refreshVerdict({ expiresAt: later, replacedAt }, { replacedAt: null }, now)).toBe(
      'replay',
    );
    expect(refreshVerdict({ expiresAt: later, replacedAt }, { replacedAt: null }, now + 1)).toBe(
      'refuse',
    );
    expect(
      refreshVerdict({ expiresAt: later, replacedAt }, { replacedAt: new Date(now) }, now),
    ).toBe('refuse');
    expect(refreshVerdict({ expiresAt: later, replacedAt }, null, now)).toBe('refuse');
  });
});
