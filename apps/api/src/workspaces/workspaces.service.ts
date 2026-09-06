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
import { AccessService } from './access.service.js';
import type {
  CreateApiKeyInput,
  CreateInviteInput,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
} from './workspaces.dto.js';
import type { Role } from './roles.js';

const suffix = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6);

/** Shown in the settings list so a key can be told apart without revealing it. */
const KEY_PREFIX = 'sp_';
const PREFIX_LENGTH = 8;

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async listForUser(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: { workspace: { include: { _count: { select: { projects: true, members: true } } } } },
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
    return { ok: true };
  }

  async removeMember(userId: string, workspaceId: string, memberUserId: string) {
    await this.access.requireWorkspace(userId, workspaceId, 'ADMIN');
    await this.requireAnotherOwnerRemains(workspaceId, memberUserId, 'VIEWER');
    await this.prisma.membership.deleteMany({ where: { workspaceId, userId: memberUserId } });
    return { ok: true };
  }

  async createInvite(userId: string, workspaceId: string, input: CreateInviteInput) {
    await this.access.requireWorkspace(userId, workspaceId, 'ADMIN');

    const token = randomToken();
    await this.prisma.invite.create({
      data: {
        workspaceId,
        createdById: userId,
        role: input.role,
        ...(input.email !== undefined && { email: input.email.toLowerCase() }),
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + input.expiresInDays * 86_400_000),
      },
    });

    // The raw token is returned exactly once; only its hash is stored.
    return { url: `${this.config.appPublicUrl}/invite/${token}` };
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

  async listApiKeys(userId: string, workspaceId: string) {
    await this.access.requireWorkspace(userId, workspaceId, 'EDITOR');
    const keys = await this.prisma.apiKey.findMany({
      where: { workspaceId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return keys.map((key) => ({
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt,
    }));
  }

  /**
   * Returns the key in full. This is the only moment it exists outside the
   * caller's machine — the database keeps a hash.
   */
  async createApiKey(userId: string, workspaceId: string, input: CreateApiKeyInput) {
    await this.access.requireWorkspace(userId, workspaceId, 'EDITOR');

    const secret = `${KEY_PREFIX}${randomToken(24)}`;
    const key = await this.prisma.apiKey.create({
      data: {
        workspaceId,
        userId,
        name: input.name,
        prefix: secret.slice(0, PREFIX_LENGTH),
        hash: hashToken(secret),
      },
    });

    return {
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      key: secret,
      mcpUrl: `${this.config.apiPublicUrl}/mcp`,
    };
  }

  async revokeApiKey(userId: string, workspaceId: string, keyId: string) {
    await this.access.requireWorkspace(userId, workspaceId, 'EDITOR');
    await this.prisma.apiKey.updateMany({
      where: { id: keyId, workspaceId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
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
