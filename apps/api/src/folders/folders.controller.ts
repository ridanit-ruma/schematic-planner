import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { FoldersService } from './folders.service.js';
import {
  createFolderSchema,
  updateFolderSchema,
  type CreateFolderInput,
  type UpdateFolderInput,
} from './folders.dto.js';

@Controller()
export class FoldersController {
  constructor(private readonly folders: FoldersService) {}

  @Get('projects/:projectId/folders')
  list(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    return this.folders.list(user.id, projectId);
  }

  @Post('projects/:projectId/folders')
  create(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body(new ZodPipe(createFolderSchema)) body: CreateFolderInput,
  ) {
    return this.folders.create(user.id, projectId, body);
  }

  @Patch('folders/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(updateFolderSchema)) body: UpdateFolderInput,
  ) {
    return this.folders.update(user.id, id, body);
  }

  @Delete('folders/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.folders.remove(user.id, id);
  }
}
