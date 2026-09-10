import { Injectable, NotFoundException } from '@nestjs/common';
import { customAlphabet } from 'nanoid';

import { PrismaService } from '../common/prisma.service.js';
import { AccessService } from '../workspaces/access.service.js';
import type { CreateProjectInput, UpdateProjectInput } from './projects.dto.js';

const suffix = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 5);

/** The project a plan lands in when nobody says which. */
const DEFAULT_SLUG = 'general';
const DEFAULT_NAME = 'General';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async list(userId: string, workspaceId: string) {
    await this.access.requireWorkspace(userId, workspaceId, 'VIEWER');
    const projects = await this.prisma.project.findMany({
      where: { workspaceId, deletedAt: null },
      include: {
        _count: {
          select: {
            plans: {
              where: { deletedAt: null, OR: [{ folderId: null }, { folder: { deletedAt: null } }] },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return projects.map((project) => ({
      id: project.id,
      slug: project.slug,
      name: project.name,
      description: project.description,
      planCount: project._count.plans,
      updatedAt: project.updatedAt,
    }));
  }

  async read(userId: string, projectId: string) {
    const access = await this.access.requireProject(userId, projectId, 'VIEWER');
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { workspace: { select: { id: true, slug: true, name: true } } },
    });
    if (project === null) throw new NotFoundException('Project not found');

    return {
      id: project.id,
      slug: project.slug,
      name: project.name,
      description: project.description,
      workspace: project.workspace,
      role: access.role,
    };
  }

  async create(userId: string, workspaceId: string, input: CreateProjectInput) {
    await this.access.requireWorkspace(userId, workspaceId, 'EDITOR');
    const project = await this.prisma.project.create({
      data: {
        workspaceId,
        name: input.name,
        description: input.description,
        slug: await this.freeSlug(workspaceId, input.name),
      },
    });
    return { id: project.id, slug: project.slug, name: project.name };
  }

  async update(userId: string, projectId: string, input: UpdateProjectInput) {
    await this.access.requireProject(userId, projectId, 'EDITOR');
    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
      },
    });
    // The slug is deliberately left alone on rename: it is in the address bar,
    // and a link somebody saved should not stop working because of a typo fix.
    return { id: project.id, slug: project.slug, name: project.name };
  }

  /**
   * To the trash, with the plans it holds. Nothing is destroyed here: the plans
   * keep their own `deletedAt` clear, so restoring the project brings back
   * exactly what was under it and nothing that was already thrown away.
   */
  async remove(userId: string, projectId: string) {
    await this.access.requireProject(userId, projectId, 'ADMIN');
    await this.prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date(), deletedById: userId },
    });
    return { ok: true };
  }

  /** Resolves `/workspace/:slug/project/:slug` to an id. */
  async bySlug(userId: string, workspaceId: string, slug: string) {
    await this.access.requireWorkspace(userId, workspaceId, 'VIEWER');
    const project = await this.prisma.project.findUnique({
      where: { workspaceId_slug: { workspaceId, slug } },
    });
    if (project === null || project.deletedAt !== null) {
      throw new NotFoundException('Project not found');
    }
    return { id: project.id, slug: project.slug, name: project.name };
  }

  /**
   * Where a plan goes when the caller did not choose. An agent asked to draw
   * something should not have to invent a project first.
   */
  async defaultFor(workspaceId: string): Promise<string> {
    const existing = await this.prisma.project.findUnique({
      where: { workspaceId_slug: { workspaceId, slug: DEFAULT_SLUG } },
    });
    if (existing !== null && existing.deletedAt === null) return existing.id;

    const first = await this.prisma.project.findFirst({
      where: { workspaceId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    if (first !== null) return first.id;

    // A trashed project keeps its slug, so the default cannot assume `general`
    // is free.
    const created = await this.prisma.project.create({
      data: {
        workspaceId,
        slug: await this.freeSlug(workspaceId, DEFAULT_NAME),
        name: DEFAULT_NAME,
      },
    });
    return created.id;
  }

  private async freeSlug(workspaceId: string, name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'project';

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}-${suffix()}`;
      const taken = await this.prisma.project.findUnique({
        where: { workspaceId_slug: { workspaceId, slug: candidate } },
      });
      if (taken === null) return candidate;
    }
    return `${base}-${suffix()}`;
  }
}
