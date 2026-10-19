import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { savedViewsSchema, type SavedViews } from '@schematic/schema';

import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ViewsService } from './views.service.js';

@Controller('projects/:id/views')
export class ViewsController {
  constructor(private readonly views: ViewsService) {}

  @Get()
  read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.views.read(user.id, id);
  }

  /** 409 when somebody saved since `version` was read. */
  @Put()
  replace(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(savedViewsSchema)) body: SavedViews,
  ) {
    return this.views.replace(user.id, id, body);
  }
}
