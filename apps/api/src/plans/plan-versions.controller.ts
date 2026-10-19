import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';

import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { PlanVersionsService } from './plan-versions.service.js';

const saveVersionSchema = z.object({ label: z.string().trim().max(80).nullish() });

@Controller('plans/:id/versions')
export class PlanVersionsController {
  constructor(private readonly versions: PlanVersionsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.versions.list(user.id, id);
  }

  @Post()
  save(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(saveVersionSchema)) body: z.infer<typeof saveVersionSchema>,
  ) {
    return this.versions.save(user.id, id, body.label || null);
  }

  /** Writes the plan back to that version, after keeping the plan as it is now. */
  @Post(':versionId/restore')
  restore(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.versions.restore(user.id, id, versionId);
  }
}
