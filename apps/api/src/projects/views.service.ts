import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { readSavedViews, type SavedViews } from '@schematic/schema';

import { PrismaService } from '../common/prisma.service.js';
import { AccessService } from '../workspaces/access.service.js';

/**
 * The tables and boards a project has saved, shared by everyone in it.
 *
 * Saved the way the vocabulary is: the whole list at once, conditional on the
 * version it was read at, so two people saving at once get a conflict rather
 * than one silently undoing the other.
 */
@Injectable()
export class ViewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async read(userId: string, projectId: string): Promise<SavedViews> {
    await this.access.requireProject(userId, projectId, 'VIEWER');
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { views: true, viewsVersion: true },
    });
    if (project === null) throw new NotFoundException('Project not found');
    return readSavedViews(project.views, project.viewsVersion);
  }

  async replace(userId: string, projectId: string, input: SavedViews): Promise<SavedViews> {
    await this.access.requireProject(userId, projectId, 'EDITOR');
    const { count } = await this.prisma.project.updateMany({
      where: { id: projectId, viewsVersion: input.version },
      data: { views: input.views, viewsVersion: { increment: 1 } },
    });
    if (count === 0) {
      throw new ConflictException(
        'stale_views: somebody else changed this project’s views since they were read.' +
          ' Read them again and reapply the change.',
      );
    }
    return { version: input.version + 1, views: input.views };
  }
}
