import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ProjectsService } from './projects.service.js';
import {
  createProjectSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from './projects.dto.js';

@Controller()
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get('workspaces/:workspaceId/projects')
  list(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
    @Query('slug') slug?: string,
  ) {
    // With `?slug=` this resolves an address bar path to an id, which is what
    // /workspace/acme/project/billing needs before it can load anything.
    if (slug !== undefined && slug !== '') {
      return this.projects.bySlug(user.id, workspaceId, slug);
    }
    return this.projects.list(user.id, workspaceId);
  }

  @Post('workspaces/:workspaceId/projects')
  create(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
    @Body(new ZodPipe(createProjectSchema)) body: CreateProjectInput,
  ) {
    return this.projects.create(user.id, workspaceId, body);
  }

  @Get('projects/:id')
  read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projects.read(user.id, id);
  }

  @Patch('projects/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(updateProjectSchema)) body: UpdateProjectInput,
  ) {
    return this.projects.update(user.id, id, body);
  }

  @Delete('projects/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projects.remove(user.id, id);
  }
}
