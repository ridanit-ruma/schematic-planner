import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../common/prisma.service.js';
import { AccessService } from '../workspaces/access.service.js';
import type { CreateFolderInput, UpdateFolderInput } from './folders.dto.js';
import { pathOf, siblingNamed, trashedFolderIds, wouldLoop } from './folder-tree.js';

export interface FolderSummary {
  id: string;
  name: string;
  /** The folder it sits in, or null at the project's top level. */
  parentId: string | null;
  /** Names from the project's top level down to this folder, its own last. */
  path: string[];
  /** Plans filed directly in it, not in the folders below it. */
  planCount: number;
  updatedAt: Date;
}

export interface FolderRecord {
  id: string;
  name: string;
  projectId: string;
  parentId: string | null;
}

/**
 * Drawers inside a project, which may hold drawers of their own.
 *
 * A folder carries no permission of its own: it is reached by walking up to the
 * workspace, the same as everything else. What it does carry is `deletedAt`, so
 * throwing one away behaves like throwing a project away — the plans and folders
 * below it keep their own marks clear and come back with it.
 */
@Injectable()
export class FoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /**
   * Every folder of the project outside the trash, in tree order: each folder
   * followed by the ones inside it, siblings by name.
   */
  async list(userId: string, projectId: string): Promise<FolderSummary[]> {
    await this.access.requireProject(userId, projectId, 'VIEWER');
    const folders = await this.prisma.folder.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { plans: { where: { deletedAt: null } } } } },
    });

    const hidden = trashedFolderIds(folders);
    const shown = folders.filter((folder) => !hidden.has(folder.id));
    const children = new Map<string | null, typeof shown>();
    for (const folder of shown) {
      children.set(folder.parentId, [...(children.get(folder.parentId) ?? []), folder]);
    }

    const out: FolderSummary[] = [];
    const walk = (parentId: string | null): void => {
      for (const folder of children.get(parentId) ?? []) {
        out.push({
          id: folder.id,
          name: folder.name,
          parentId: folder.parentId,
          path: pathOf(folders, folder.id),
          planCount: folder._count.plans,
          updatedAt: folder.updatedAt,
        });
        walk(folder.id);
      }
    };
    walk(null);
    return out;
  }

  async create(userId: string, projectId: string, input: CreateFolderInput): Promise<FolderRecord> {
    await this.access.requireProject(userId, projectId, 'EDITOR');
    const parentId = input.parentId ?? null;
    if (parentId !== null) await this.requireParent(userId, projectId, parentId);

    const siblings = await this.prisma.folder.findMany({
      where: { projectId, parentId, deletedAt: null },
      select: { id: true, parentId: true, name: true, deletedAt: true },
    });
    this.refuseClash(siblings, parentId, input.name);

    const folder = await this.prisma.folder.create({
      data: { projectId, parentId, name: input.name },
    });
    return record(folder);
  }

  /** A rename, a move to another parent in the same project, or both. */
  async update(userId: string, folderId: string, input: UpdateFolderInput): Promise<FolderRecord> {
    const access = await this.access.requireFolder(userId, folderId, 'EDITOR');
    const folders = await this.prisma.folder.findMany({
      where: { projectId: access.projectId },
      select: { id: true, parentId: true, name: true, deletedAt: true },
    });
    const self = folders.find((folder) => folder.id === folderId);
    if (self === undefined) throw new NotFoundException('Folder not found');

    const parentId = input.parentId === undefined ? self.parentId : input.parentId;
    const name = input.name ?? self.name;

    if (parentId !== self.parentId && parentId !== null) {
      await this.requireParent(userId, access.projectId, parentId);
      if (wouldLoop(folders, folderId, parentId)) {
        throw new BadRequestException('A folder cannot go inside itself or a folder inside it');
      }
    }
    // Asked only when something changes, so a pair of twins made before names
    // were unique can still be told apart by renaming either of them.
    if (parentId !== self.parentId || name !== self.name) {
      this.refuseClash(folders, parentId, name, folderId);
    }

    const folder = await this.prisma.folder.update({
      where: { id: folderId },
      data: { name, parentId },
    });
    return record(folder);
  }

  /**
   * The folder at this path, making whichever part of it is missing.
   *
   * Each name is matched as `create` would refuse it — case and outer spaces
   * aside — so asking twice for `Specs/Billing` gives one Billing, not two.
   */
  async ensurePath(
    userId: string,
    projectId: string,
    names: readonly string[],
  ): Promise<{ folder: FolderRecord; made: string[] }> {
    await this.access.requireProject(userId, projectId, 'EDITOR');
    if (names.length === 0) throw new BadRequestException('A folder path needs at least one name');

    const folders = await this.prisma.folder.findMany({
      where: { projectId },
      select: { id: true, parentId: true, name: true, deletedAt: true, projectId: true },
    });
    const hidden = trashedFolderIds(folders);
    const shown = folders.filter((folder) => !hidden.has(folder.id));

    let parentId: string | null = null;
    let reached: FolderRecord | null = null;
    const made: string[] = [];
    for (const name of names) {
      const found = siblingNamed(shown, parentId, name);
      if (found !== undefined) {
        reached = record(found);
      } else {
        reached = record(
          await this.prisma.folder.create({ data: { projectId, parentId, name: name.trim() } }),
        );
        made.push(reached.name);
      }
      parentId = reached.id;
    }
    return { folder: reached as FolderRecord, made };
  }

  /** Into the trash, with whatever is filed in it and below it. */
  async remove(userId: string, folderId: string): Promise<{ ok: true }> {
    await this.access.requireFolder(userId, folderId, 'ADMIN');
    await this.prisma.folder.update({
      where: { id: folderId },
      data: { deletedAt: new Date(), deletedById: userId },
    });
    return { ok: true };
  }

  /** A parent must be a folder of the same project, and not in the trash. */
  private async requireParent(userId: string, projectId: string, parentId: string): Promise<void> {
    const parent = await this.access.requireFolder(userId, parentId, 'EDITOR');
    if (parent.projectId !== projectId) throw new NotFoundException('Folder not found');
  }

  private refuseClash(
    folders: readonly {
      id: string;
      parentId: string | null;
      name: string;
      deletedAt: Date | null;
    }[],
    parentId: string | null,
    name: string,
    except: string | null = null,
  ): void {
    const clash = siblingNamed(folders, parentId, name, except);
    if (clash !== undefined) {
      throw new ConflictException(`There is already a folder called "${clash.name}" there`);
    }
  }
}

function record(folder: {
  id: string;
  name: string;
  projectId: string;
  parentId: string | null;
}): FolderRecord {
  return {
    id: folder.id,
    name: folder.name,
    projectId: folder.projectId,
    parentId: folder.parentId,
  };
}
