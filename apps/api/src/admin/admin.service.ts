import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { CollabService } from '../collab/collab.service.js';
import { APP_CONFIG, type AppConfig } from '../config/env.js';
import { hashToken, randomToken } from '../common/crypto.js';
import { PrismaService } from '../common/prisma.service.js';
import type { CreateInviteInput, UpdateAccountInput } from './admin.dto.js';
import { inviteState, type InviteState } from './invite-state.js';

/** How far back the trend charts look. Two weeks reads at a glance. */
const TREND_DAYS = 14;
const RECENT_DAYS = 7;

export interface InviteSummary {
  id: string;
  label: string;
  prefix: string;
  maxUses: number | null;
  uses: number;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  createdBy: string;
  /** Whether it would let somebody in right now, and why not when it would not. */
  state: InviteState;
  accounts: { id: string; name: string; email: string; createdAt: Date }[];
}

export interface AccountSummary {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  instanceRole: 'OWNER' | 'MEMBER';
  suspendedAt: Date | null;
  createdAt: Date;
  invitedVia: { id: string; label: string } | null;
  workspaces: number;
  plans: number;
  keys: number;
  sessions: number;
  /** The last thing they changed in any plan, which is the only honest "active". */
  lastChangeAt: Date | null;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collab: CollabService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  // ---------------------------------------------------------------- invitations

  /**
   * Issues a way in. The token is returned once and never again — only its hash
   * is kept, the way a session's is.
   */
  async createInvite(userId: string, input: CreateInviteInput) {
    const token = randomToken(24);
    const invite = await this.prisma.signupInvite.create({
      data: {
        tokenHash: hashToken(token),
        prefix: token.slice(0, 8),
        label: input.label,
        maxUses: input.maxUses,
        expiresAt:
          input.expiresInDays === null
            ? null
            : new Date(Date.now() + input.expiresInDays * 86_400_000),
        createdById: userId,
      },
    });
    return { id: invite.id, token, prefix: invite.prefix };
  }

  /**
   * Everything that could let somebody in right now, and everything that used
   * to.
   *
   * The code in the configuration is one of those things, so it is returned
   * here rather than merely alluded to: a screen that lists ways in and leaves
   * out the one that is a plain string anybody could be holding is worse than
   * no screen. It is shown to the owner, who set it.
   */
  async listInvites(): Promise<{ code: string | null; invites: InviteSummary[] }> {
    const rows = await this.prisma.signupInvite.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { name: true } },
        accounts: {
          select: { id: true, name: true, email: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const invites = rows.map((row) => ({
      id: row.id,
      label: row.label,
      prefix: row.prefix,
      maxUses: row.maxUses,
      uses: row.uses,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
      createdBy: row.createdBy.name,
      state: inviteState(row),
      accounts: row.accounts,
    }));

    return {
      code: this.config.registrationCode === '' ? null : this.config.registrationCode,
      invites,
    };
  }

  /**
   * Stops it working, and keeps the record.
   *
   * The accounts that came in through it still point at it, and knowing who let
   * whom in is worth more than a tidy table — so this is the ordinary way to
   * end an invitation, and forgetting it is a separate, deliberate act.
   */
  async revokeInvite(id: string): Promise<{ ok: true }> {
    const invite = await this.prisma.signupInvite.findUnique({ where: { id } });
    if (invite === null) throw new NotFoundException('No such invitation');
    if (invite.revokedAt === null) {
      await this.prisma.signupInvite.update({ where: { id }, data: { revokedAt: new Date() } });
    }
    return { ok: true };
  }

  /**
   * Forgets it entirely.
   *
   * The accounts it let in stay, and stop saying how they got here — which is
   * the whole cost, and the reason this is not what the withdraw button does.
   */
  async deleteInvite(id: string): Promise<{ ok: true }> {
    const invite = await this.prisma.signupInvite.findUnique({ where: { id } });
    if (invite === null) throw new NotFoundException('No such invitation');
    await this.prisma.signupInvite.delete({ where: { id } });
    return { ok: true };
  }

  // ------------------------------------------------------------------- accounts

  async listAccounts(): Promise<AccountSummary[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        invitedVia: { select: { id: true, label: true } },
        _count: { select: { memberships: true, sessions: true, apiKeys: true } },
      },
    });

    // One grouped query rather than one per person: a list of accounts should
    // not cost a query per row to draw.
    const [plans, lastChange] = await Promise.all([
      this.prisma.membership.findMany({ select: { userId: true, workspaceId: true } }),
      this.prisma.planChange.groupBy({
        by: ['userId'],
        _max: { createdAt: true },
      }),
    ]);
    const planCounts = await this.plansPerWorkspace();
    const lastByUser = new Map(lastChange.map((row) => [row.userId, row._max.createdAt]));
    const byUser = new Map<string, number>();
    for (const row of plans) {
      byUser.set(row.userId, (byUser.get(row.userId) ?? 0) + (planCounts.get(row.workspaceId) ?? 0));
    }

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      instanceRole: user.instanceRole,
      suspendedAt: user.suspendedAt,
      createdAt: user.createdAt,
      invitedVia: user.invitedVia,
      workspaces: user._count.memberships,
      plans: byUser.get(user.id) ?? 0,
      keys: user._count.apiKeys,
      sessions: user._count.sessions,
      lastChangeAt: lastByUser.get(user.id) ?? null,
    }));
  }

  async updateAccount(
    actorId: string,
    id: string,
    input: UpdateAccountInput,
  ): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (user === null) throw new NotFoundException('No such account');

    // An instance with no owner cannot be administered by anyone, and there is
    // no way back into it from inside the product.
    if (user.instanceRole === 'OWNER' && input.instanceRole === 'MEMBER') {
      const owners = await this.prisma.user.count({
        where: { instanceRole: 'OWNER', suspendedAt: null },
      });
      if (owners <= 1) throw new BadRequestException('The instance would have no owner left');
    }
    if (id === actorId && input.suspended === true) {
      throw new BadRequestException('Suspending yourself would lock you out');
    }

    const suspendedAt =
      input.suspended === undefined ? undefined : input.suspended ? new Date() : null;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          ...(input.instanceRole === undefined ? {} : { instanceRole: input.instanceRole }),
          ...(suspendedAt === undefined ? {} : { suspendedAt }),
        },
      }),
      // Suspending has to take effect now, not in fifteen minutes when the
      // access token they are holding expires.
      ...(input.suspended === true ? [this.prisma.session.deleteMany({ where: { userId: id } })] : []),
    ]);
    return { ok: true };
  }

  // ---------------------------------------------------------------------- usage

  /**
   * What this instance is, in numbers it already knows.
   *
   * Everything here is a count of something that exists, or a moment that was
   * recorded — no sampling, no estimation, nothing that has to be kept up to
   * date by a background job that can fall behind and lie.
   */
  async usage() {
    const since = new Date(Date.now() - RECENT_DAYS * 86_400_000);
    const trendFrom = new Date(Date.now() - TREND_DAYS * 86_400_000);

    const [
      users,
      suspended,
      newUsers,
      workspaces,
      projects,
      plans,
      trashedPlans,
      changes,
      recentChanges,
      agentChanges,
      keys,
      liveKeys,
      sessions,
      shares,
      invites,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { suspendedAt: { not: null } } }),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.workspace.count(),
      this.prisma.project.count({ where: { deletedAt: null } }),
      this.prisma.plan.count({ where: { deletedAt: null } }),
      this.prisma.plan.count({ where: { deletedAt: { not: null } } }),
      this.prisma.planChange.count(),
      this.prisma.planChange.count({ where: { createdAt: { gte: since } } }),
      this.prisma.planChange.count({ where: { apiKeyId: { not: null } } }),
      this.prisma.apiKey.count(),
      this.prisma.apiKey.count({ where: { revokedAt: null } }),
      this.prisma.session.count({ where: { expiresAt: { gte: new Date() } } }),
      this.prisma.planShare.count(),
      this.prisma.signupInvite.count({ where: { revokedAt: null } }),
    ]);

    const [drawing, active, trend, busiest, agents, size] = await Promise.all([
      this.drawing(),
      this.prisma.planChange.findMany({
        where: { createdAt: { gte: since } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      this.trend(trendFrom),
      this.busiestWorkspaces(),
      this.agentKeys(),
      this.databaseBytes(),
    ]);

    return {
      accounts: { total: users, suspended, joinedRecently: newUsers, activeRecently: active.length },
      content: {
        workspaces,
        projects,
        plans,
        trashedPlans,
        nodes: drawing.nodes,
        edges: drawing.edges,
        largestPlan: drawing.largest,
      },
      activity: {
        changes,
        changesRecently: recentChanges,
        byAgents: agentChanges,
        trend,
      },
      agents: { keys, liveKeys, recent: agents },
      reach: { sessions, shares, liveInvites: invites },
      // What is happening right now rather than what has happened. Held by this
      // process, so it is the truth for this replica — and there is only ever
      // one, because the documents live in its memory.
      live: {
        documents: this.collab.hocuspocus.documents.size,
        connections: this.collab.hocuspocus.getConnectionsCount(),
      },
      storage: { databaseBytes: size },
      busiest,
      days: TREND_DAYS,
      recentDays: RECENT_DAYS,
    };
  }

  /** Counted from the stored projections rather than the CRDTs, which is what they are for. */
  private async drawing(): Promise<{ nodes: number; edges: number; largest: number }> {
    const rows = await this.prisma.$queryRaw<{ nodes: bigint; edges: bigint; largest: bigint }[]>`
      SELECT
        COALESCE(SUM(jsonb_array_length("snapshot"->'nodes')), 0) AS nodes,
        COALESCE(SUM(jsonb_array_length("snapshot"->'edges')), 0) AS edges,
        COALESCE(MAX(jsonb_array_length("snapshot"->'nodes')), 0) AS largest
      FROM "Plan"
      WHERE "deletedAt" IS NULL
        AND jsonb_typeof("snapshot"->'nodes') = 'array'
        AND jsonb_typeof("snapshot"->'edges') = 'array'`;
    const row = rows[0];
    return {
      nodes: Number(row?.nodes ?? 0),
      edges: Number(row?.edges ?? 0),
      largest: Number(row?.largest ?? 0),
    };
  }

  /** One row per day, so a fortnight reads as a shape rather than a number. */
  private async trend(from: Date): Promise<{ day: string; people: number; agents: number }[]> {
    const rows = await this.prisma.$queryRaw<
      { day: Date; people: bigint; agents: bigint }[]
    >`
      SELECT date_trunc('day', "createdAt") AS day,
             COUNT(*) FILTER (WHERE "apiKeyId" IS NULL) AS people,
             COUNT(*) FILTER (WHERE "apiKeyId" IS NOT NULL) AS agents
      FROM "PlanChange"
      WHERE "createdAt" >= ${from}
      GROUP BY 1
      ORDER BY 1`;
    return rows.map((row) => ({
      day: row.day.toISOString().slice(0, 10),
      people: Number(row.people),
      agents: Number(row.agents),
    }));
  }

  private async busiestWorkspaces() {
    const rows = await this.prisma.$queryRaw<
      { name: string; slug: string; plans: bigint; changes: bigint }[]
    >`
      SELECT w."name", w."slug",
             COUNT(DISTINCT p."id") AS plans,
             COUNT(c."id") AS changes
      FROM "Workspace" w
      LEFT JOIN "Project" pr ON pr."workspaceId" = w."id" AND pr."deletedAt" IS NULL
      LEFT JOIN "Plan" p ON p."projectId" = pr."id" AND p."deletedAt" IS NULL
      LEFT JOIN "PlanChange" c ON c."planId" = p."id"
      GROUP BY w."id"
      ORDER BY COUNT(c."id") DESC, COUNT(DISTINCT p."id") DESC
      LIMIT 5`;
    return rows.map((row) => ({
      name: row.name,
      slug: row.slug,
      plans: Number(row.plans),
      changes: Number(row.changes),
    }));
  }

  /** Which keys are actually working, rather than how many exist. */
  private async agentKeys() {
    const rows = await this.prisma.apiKey.findMany({
      where: { revokedAt: null, lastUsedAt: { not: null } },
      orderBy: { lastUsedAt: 'desc' },
      take: 5,
      select: { name: true, lastUsedAt: true, user: { select: { name: true } } },
    });
    return rows.map((row) => ({ name: row.name, by: row.user.name, lastUsedAt: row.lastUsedAt }));
  }

  private async databaseBytes(): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ size: bigint }[]>`
      SELECT pg_database_size(current_database()) AS size`;
    return Number(rows[0]?.size ?? 0);
  }

  private async plansPerWorkspace(): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<{ workspaceId: string; plans: bigint }[]>`
      SELECT pr."workspaceId", COUNT(p."id") AS plans
      FROM "Project" pr
      LEFT JOIN "Plan" p ON p."projectId" = pr."id" AND p."deletedAt" IS NULL
      WHERE pr."deletedAt" IS NULL
      GROUP BY pr."workspaceId"`;
    return new Map(rows.map((row) => [row.workspaceId, Number(row.plans)]));
  }
}
