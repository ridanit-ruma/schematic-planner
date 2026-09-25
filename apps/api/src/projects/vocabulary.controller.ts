import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';

import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import { StrictRateLimit } from '../common/throttle.js';
import { ZodPipe } from '../common/zod.pipe.js';
import {
  addTagSchema,
  replaceVocabularySchema,
  type AddTagInput,
  type ReplaceVocabularyInput,
} from './projects.dto.js';
import { VocabularyService } from './vocabulary.service.js';

@Controller()
export class VocabularyController {
  constructor(private readonly vocabulary: VocabularyService) {}

  @Get('projects/:id/vocabulary')
  read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.vocabulary.read(user.id, id);
  }

  /** 409 when somebody saved since `version` was read. */
  @Put('projects/:id/vocabulary')
  replace(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(replaceVocabularySchema)) body: ReplaceVocabularyInput,
  ) {
    return this.vocabulary.replace(user.id, id, body);
  }

  @Post('projects/:id/vocabulary/tags')
  addTag(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(addTagSchema)) body: AddTagInput,
  ) {
    return this.vocabulary.addTag(user.id, id, body);
  }

  /**
   * A plan is addressed on its own, without its project, so the canvas asks
   * for its project's vocabulary through the plan.
   */
  @Get('plans/:planId/vocabulary')
  forPlan(@CurrentUser() user: AuthUser, @Param('planId') planId: string) {
    return this.vocabulary.forPlan(user.id, planId);
  }

  @Public()
  @StrictRateLimit()
  @Get('share/:token/vocabulary')
  forShare(@Param('token') token: string) {
    return this.vocabulary.forShare(token);
  }
}
