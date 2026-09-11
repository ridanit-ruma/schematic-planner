import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { customAlphabet } from 'nanoid';

import { hashToken, randomToken } from '../common/crypto.js';
import { PrismaService } from '../common/prisma.service.js';
import { APP_CONFIG, type AppConfig } from '../config/env.js';
import { CollabService } from '../collab/collab.service.js';
import { AccessService } from './access.service.js';
import type {
  CreateInviteInput,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
} from './workspaces.dto.js';
import { atLeast, type Role } from './roles.js';

const suffix = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6);

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly collab: CollabService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async listForUser(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: {
        workspace: {
          include: {
            _count: { select: { projects: { where: { deletedAt: null } }, members: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((membership) => ({
      id: membership.workspace.id,
      slug: membership.workspace.slug,
      name: membership.workspace.name,
      role: membership.role,
      projectCount: membership.workspace._count.projects,
      memberCount: membership.workspace._count.members,
    }));
  }

  async create(userId: string, input: CreateWorkspaceInput) {
    const workspace = await this.prisma.workspace.create({
      data: {
        name: input.name,
        slug: await this.freeSlug(input.name),
        members: { create: { userId, role: 'OWNER' } },
        projects: { create: { slug: 'general', name: 'General' } },
      },
    });
    return { id: workspace.id, slug: workspace.slug, name: workspace.name, role: 'OWNER' as Role };
  }

  async update(userId: string, workspaceId: string, input: UpdateWorkspaceInput) {
    await this.access.requireWorkspace(userId, workspaceId, 'ADMIN');
    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: input.name },
    });
    // The slug stays put on rename. It is in the address bar, and a link
    // somebody saved should survive a change of mind about the name.
    return { id: workspace.id, slug: workspace.slug, name: workspace.name };
  }

  /** Takes every project and plan in it. Only an owner can, and only by name. */
  async remove(userId: string, workspaceId: string, confirm: string) {
    await this.access.requireWorkspace(userId, workspaceId, 'OWNER');
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (workspace === null) throw new NotFoundException('Workspace not found');
    if (confirm !== workspace.name) {
      throw new BadRequestException('Type the workspace name exactly to confirm');
    }

    await this.prisma.workspace.delete({ where: { id: workspaceId } });
    return { ok: true as const };
  }

  async members(userId: string, workspaceId: string) {
    await this.access.requireWorkspace(userId, workspaceId, 'VIEWER');
    const members = await this.prisma.membership.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((member) => ({ role: member.role, user: member.user }));
  }

  async updateMember(userId: string, workspaceId: string, memberUserId: string, role: Role) {
    await this.access.requireWorkspace(userId, workspaceId, 'ADMIN');
    if (memberUserId === userId) throw new BadRequestException('You cannot change your own role');

    await this.requireAnotherOwnerRemains(workspaceId, memberUserId, role);
    await this.prisma.membership.update({
      where: { userId_workspaceId: { userId: memberUserId, workspaceId } },
      data: { role },
    });
    // A socket is authorised when it opens and never again, so an editor demoted
    // to viewer keeps writing until something says otherwise. Dropped rather
    // than adjusted in place: reconnecting runs the real check, which leaves one
    // copy of the permission rules instead of two.
    this.collab.revoke(memberUserId);
    return { ok: true };
  }

  async removeMember(userId: string, workspaceId: string, memberUserId: string) {
    await this.access.requireWorkspace(userId, workspaceId, 'ADMIN');
    // Matching `updateMember`, and for the same reason: your own row is the one
    // row you cannot reason about while you are standing on it.
    if (memberUserId === userId) throw new BadRequestException('You cannot remove yourself');
    await this.requireAnotherOwnerRemains(workspaceId, memberUserId, 'VIEWER');
    await this.prisma.membership.deleteMany({ where: { workspaceId, userId: memberUserId } });
    // Removal is the stronger case: without this they keep receiving everybody
    // else's edits on a plan they are no longer on.
    this.collab.revoke(memberUserId);
    return { ok: true };
  }

  async createInvite(userId: string, workspaceId: string, input: CreateInviteInput) {
    const actor = await this.access.requireWorkspace(userId, workspaceId, 'ADMIN');

    // Nobody may issue a way in that outranks them. An admin handing out OWNER
    // is how the one rule this file does enforce -- that a workspace keeps an
    // owner -- gets walked around: mint the invite, drop your own membership so
    // the upsert below takes its create branch, accept, and the workspace has a
    // second owner who can now demote the first.
    if (!atLeast(actor, input.role)) {
      throw new ForbiddenException('You cannot invite someone above your own role');
    }

    const token = randomToken();
    await this.prisma.invite.create({
      data: {
        workspaceId,
        createdById: userId,
        role: input.role,
        ...(input.email !== undefined && { email: input.email.toLowerCase() }),
        tokenHash: hashToken(token),
        prefix: token.slice(0, 6),
        expiresAt: new Date(Date.now() + input.expiresInDays * 86_400_000),
      },
    });

    // The raw token is returned exactly once; only its hash is stored.
    return { url: `${this.config.appPublicUrl}/invite/${token}` };
  }

  /**
   * The invitations that would still let somebody in.
   *
   * Spent and expired ones are not listed at all, following the instance's own
   * invitation screen: a list of links that no longer work is a list nobody can
   * act on, and the question being asked here is always "what is still open".
   */
  async listInvites(userId: string, workspaceId: string) {
    await this.access.requireWorkspace(userId, workspaceId, 'ADMIN');

    const invites = await this.prisma.invite.findMany({
      where: { workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { name: true } } },
    });

    return invites.map((invite) => ({
      id: invite.id,
      prefix: invite.prefix,
      role: invite.role,
      email: invite.email,
      createdBy: invite.createdBy.name,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
    }));
  }

  /**
   * Withdrawn by removing the row, which is what makes the link stop working.
   * There is no history to keep here the way there is for an instance
   * invitation: this one is single use, and an unused link that was taken back
   * has nothing left to say.
   */
  async revokeInvite(userId: string, workspaceId: string, inviteId: string) {
    await this.access.requireWorkspace(userId, workspaceId, 'ADMIN');
    // Scoped to the workspace, so an id from somewhere else cannot be used to
    // reach past the check that was just made.
    const removed = await this.prisma.invite.deleteMany({
      where: { id: inviteId, workspaceId },
    });
    if (removed.count === 0) throw new NotFoundException('That invitation is not there');
    return { ok: true };
  }

  async acceptInvite(userId: string, token: string) {
    const invite = await this.prisma.invite.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { workspace: true },
    });

    if (invite === null || invite.acceptedAt !== null) {
      throw new NotFoundException('That invitation is not valid');
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new ForbiddenException('That invitation has expired');
    }

    await this.prisma.$transaction([
      this.prisma.membership.upsert({
        where: { userId_workspaceId: { userId, workspaceId: invite.workspaceId } },
        create: { userId, workspaceId: invite.workspaceId, role: invite.role },
        update: {},
      }),
      this.prisma.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    return { workspace: { id: invite.workspace.id, name: invite.workspace.name } };
  }

  /** A workspace with no owner cannot be administered again. */
  private async requireAnotherOwnerRemains(
    workspaceId: string,
    targetUserId: string,
    nextRole: Role,
  ): Promise<void> {
    if (nextRole === 'OWNER') return;

    const target = await this.prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    });
    if (target === null || target.role !== 'OWNER') return;

    const owners = await this.prisma.membership.count({ where: { workspaceId, role: 'OWNER' } });
    if (owners <= 1) throw new BadRequestException('A workspace must keep at least one owner');
  }

  private async freeSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'workspace';

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}-${suffix()}`;
      const taken = await this.prisma.workspace.findUnique({ where: { slug: candidate } });
      if (taken === null) return candidate;
    }
    return `${base}-${suffix()}`;
  }
}
