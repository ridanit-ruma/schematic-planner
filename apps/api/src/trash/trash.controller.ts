import { Controller, Delete, Get, Param, Post } from '@nestjs/common';

import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { TrashService } from './trash.service.js';

@Controller()
export class TrashController {
  constructor(private readonly trash: TrashService) {}

  @Get('workspaces/:workspaceId/trash')
  list(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string) {
    return this.trash.list(user.id, workspaceId);
  }

  @Delete('workspaces/:workspaceId/trash')
  empty(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string) {
    return this.trash.empty(user.id, workspaceId);
  }

  @Post('trash/plans/:id/restore')
  restorePlan(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.trash.restorePlan(user.id, id);
  }

  @Post('trash/projects/:id/restore')
  restoreProject(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.trash.restoreProject(user.id, id);
  }

  @Delete('trash/plans/:id')
  purgePlan(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.trash.purgePlan(user.id, id);
  }

  @Delete('trash/projects/:id')
  purgeProject(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.trash.purgeProject(user.id, id);
  }
}
