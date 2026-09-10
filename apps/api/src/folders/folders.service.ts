import { Injectable } from '@nestjs/common';

import { PrismaService } from '../common/prisma.service.js';
import { AccessService } from '../workspaces/access.service.js';
import type { CreateFolderInput, UpdateFolderInput } from './folders.dto.js';

export interface FolderSummary {
  id: string;
  name: string;
  planCount: number;
  updatedAt: Date;
}

/**
 * Drawers inside a project.
 *
 * A folder carries no permission of its own: it is reached by walking up to the
 * workspace, the same as everything else. What it does carry is `deletedAt`, so
 * throwing one away behaves like throwing a project away — the plans inside
 * keep their own mark clear and come back with it.
 */
@Injectable()
export class FoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async list(userId: string, projectId: string): Promise<FolderSummary[]> {
    await this.access.requireProject(userId, projectId, 'VIEWER');
    const folders = await this.prisma.folder.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { name: 'asc' },
      include: { _count: { select: { plans: { where: { deletedAt: null } } } } },
    });

    return folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      planCount: folder._count.plans,
      updatedAt: folder.updatedAt,
    }));
  }

  async create(userId: string, projectId: string, input: CreateFolderInput) {
    await this.access.requireProject(userId, projectId, 'EDITOR');
    const folder = await this.prisma.folder.create({
      data: { projectId, name: input.name },
    });
    return { id: folder.id, name: folder.name, projectId: folder.projectId };
  }

  async update(userId: string, folderId: string, input: UpdateFolderInput) {
    await this.access.requireFolder(userId, folderId, 'EDITOR');
    const folder = await this.prisma.folder.update({
      where: { id: folderId },
      data: { name: input.name },
    });
    return { id: folder.id, name: folder.name, projectId: folder.projectId };
  }

  /** Into the trash, with whatever is filed in it. */
  async remove(userId: string, folderId: string): Promise<{ ok: true }> {
    await this.access.requireFolder(userId, folderId, 'ADMIN');
    await this.prisma.folder.update({
      where: { id: folderId },
      data: { deletedAt: new Date(), deletedById: userId },
    });
    return { ok: true };
  }
}
