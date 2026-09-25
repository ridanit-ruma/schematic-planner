import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  droppedIds,
  readVocabulary,
  tagOf,
  withTag,
  type PaletteColor,
  type Vocabulary,
} from '@schematic/schema';

import { PrismaService } from '../common/prisma.service.js';
import { AccessService } from '../workspaces/access.service.js';
import { atLeast, type Role } from '../workspaces/roles.js';

/** How often a tag is retried against somebody else's save before giving up. */
const TAG_ATTEMPTS = 5;

/** What a plan's canvas needs to draw with its project's words, and to offer editing them. */
export interface PlanVocabulary {
  project: { id: string; slug: string; name: string };
  workspace: { slug: string };
  role: Role;
  /** Whether this reader may change the vocabulary. Editors may. */
  canEdit: boolean;
  vocabulary: Vocabulary;
}

/**
 * The statuses, kinds and tags of a project.
 *
 * Every write is conditional on the version it was read at, so two people
 * editing at once get a conflict rather than one silently undoing the other.
 * The condition is part of the update itself, not a read before it, so there
 * is no window between checking and writing for a second save to land in.
 */
@Injectable()
export class VocabularyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async read(userId: string, projectId: string): Promise<Vocabulary> {
    await this.access.requireProject(userId, projectId, 'VIEWER');
    return this.ofProject(projectId);
  }

  /** No access check: for callers that have already made one. */
  async ofProject(projectId: string): Promise<Vocabulary> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { vocabulary: true, vocabularyVersion: true },
    });
    if (project === null) throw new NotFoundException('Project not found');
    return readVocabulary(project.vocabulary, project.vocabularyVersion);
  }

  /** The vocabulary of the project a plan is in. No access check. */
  async ofPlan(planId: string): Promise<Vocabulary> {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      select: { project: { select: { vocabulary: true, vocabularyVersion: true } } },
    });
    if (plan === null) throw new NotFoundException('Plan not found');
    return readVocabulary(plan.project.vocabulary, plan.project.vocabularyVersion);
  }

  async forPlan(userId: string, planId: string): Promise<PlanVocabulary> {
    const access = await this.access.requirePlan(userId, planId, 'VIEWER');
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      select: {
        project: {
          select: {
            id: true,
            slug: true,
            name: true,
            vocabulary: true,
            vocabularyVersion: true,
            workspace: { select: { slug: true } },
          },
        },
      },
    });
    if (plan === null) throw new NotFoundException('Plan not found');
    const { project } = plan;
    return {
      project: { id: project.id, slug: project.slug, name: project.name },
      workspace: { slug: project.workspace.slug },
      role: access.role,
      canEdit: atLeast(access.role, 'EDITOR'),
      vocabulary: readVocabulary(project.vocabulary, project.vocabularyVersion),
    };
  }

  /** What a shared plan is drawn with. The token is the only credential. */
  async forShare(token: string): Promise<Vocabulary> {
    const share = await this.prisma.planShare.findUnique({ where: { token } });
    if (share === null) throw new NotFoundException('That link is not valid');
    if (share.expiresAt !== null && share.expiresAt.getTime() < Date.now()) {
      throw new NotFoundException('That link has expired');
    }
    return this.ofPlan(share.planId);
  }

  /**
   * Replaces the whole vocabulary, if nobody has saved since it was read.
   *
   * A status or kind may be archived but not dropped: nodes store its id, and
   * a vocabulary that forgot it would draw them as unknown.
   */
  async replace(userId: string, projectId: string, input: Vocabulary): Promise<Vocabulary> {
    await this.access.requireProject(userId, projectId, 'EDITOR');
    const current = await this.ofProject(projectId);
    if (input.version !== current.version) throw stale(current.version);

    const dropped = droppedIds(current, input);
    if (dropped.length > 0) {
      throw new BadRequestException(
        `Removing is archiving: ${dropped.join(', ')} would be forgotten. Archive it instead.`,
      );
    }

    return this.write(projectId, input.version, {
      statuses: input.statuses,
      kinds: input.kinds,
      tags: input.tags,
    });
  }

  /**
   * Adds one tag, for a tag typed into a node that the project did not have.
   *
   * Idempotent, and it does not ask for a version: two people inventing the
   * same tag at once should both end up with it, not one of them with a
   * conflict. A save that lands in between is simply retried against.
   */
  async addTag(
    userId: string,
    projectId: string,
    input: { name: string; color?: PaletteColor },
  ): Promise<Vocabulary> {
    await this.access.requireProject(userId, projectId, 'EDITOR');
    for (let attempt = 0; attempt < TAG_ATTEMPTS; attempt += 1) {
      const current = await this.ofProject(projectId);
      if (tagOf(current, input.name) !== undefined) return current;
      const next = withTag(current, input.name, input.color);
      try {
        return await this.write(projectId, current.version, {
          statuses: next.statuses,
          kinds: next.kinds,
          tags: next.tags,
        });
      } catch (error) {
        if (!(error instanceof ConflictException)) throw error;
      }
    }
    throw stale(null);
  }

  private async write(
    projectId: string,
    version: number,
    lists: Omit<Vocabulary, 'version'>,
  ): Promise<Vocabulary> {
    const { count } = await this.prisma.project.updateMany({
      where: { id: projectId, vocabularyVersion: version },
      data: { vocabulary: lists, vocabularyVersion: { increment: 1 } },
    });
    if (count === 0) throw stale(null);
    return { version: version + 1, ...lists };
  }
}

function stale(current: number | null): ConflictException {
  return new ConflictException(
    'stale_vocabulary: somebody else changed this vocabulary since it was read' +
      (current === null ? '.' : `; it is at version ${current}.`) +
      ' Read it again and reapply the change.',
  );
}
