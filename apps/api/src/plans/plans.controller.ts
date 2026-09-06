import { Body, Controller, Delete, Get, Param, Patch, Post, Res } from '@nestjs/common';
import { exportFileName } from '@schematic/exporter';
import type { Response } from 'express';

import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import { StrictRateLimit } from '../common/throttle.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { PlansService } from './plans.service.js';
import {
  applyOpsSchema,
  createPlanSchema,
  layoutSchema,
  shareSchema,
  updatePlanSchema,
  type ApplyOpsInput,
  type CreatePlanInput,
  type LayoutInput,
  type ShareInput,
  type UpdatePlanInput,
} from './plans.dto.js';

@Controller()
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get('projects/:projectId/plans')
  list(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    return this.plans.list(user.id, projectId);
  }

  @Post('projects/:projectId/plans')
  create(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body(new ZodPipe(createPlanSchema)) body: CreatePlanInput,
  ) {
    return this.plans.create(user.id, projectId, body);
  }

  @Get('plans/:id')
  read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.plans.read(user.id, id);
  }

  /** The workspace tree around this plan, for the switcher on the canvas. */
  @Get('plans/:id/navigation')
  navigation(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.plans.navigation(user.id, id);
  }

  @Patch('plans/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(updatePlanSchema)) body: UpdatePlanInput,
  ) {
    return this.plans.update(user.id, id, body);
  }

  @Delete('plans/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.plans.remove(user.id, id);
  }

  /** The REST twin of the MCP `apply_ops` tool. Same schema, same code path. */
  @Post('plans/:id/ops')
  applyOps(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(applyOpsSchema)) body: ApplyOpsInput,
  ) {
    return this.plans.applyOps(user.id, id, body.ops);
  }

  @Post('plans/:id/layout')
  layout(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(layoutSchema)) body: LayoutInput,
  ) {
    return this.plans.layout(user.id, id, body);
  }

  @Get('plans/:id/export')
  async exportZip(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res() response: Response,
  ): Promise<void> {
    const { doc, zip } = await this.plans.exportZip(user.id, id);
    response.setHeader('Content-Type', 'application/zip');
    response.setHeader('Content-Disposition', `attachment; filename="${exportFileName(doc)}"`);
    response.end(Buffer.from(zip));
  }

  @Post('plans/:id/share')
  share(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(shareSchema)) body: ShareInput,
  ) {
    return this.plans.share(user.id, id, body);
  }

  @Delete('plans/:id/share')
  unshare(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.plans.unshare(user.id, id);
  }

  @Public()
  @StrictRateLimit()
  @Get('share/:token')
  readShared(@Param('token') token: string) {
    return this.plans.readShared(token);
  }

  @Public()
  @StrictRateLimit()
  @Get('share/:token/export')
  async exportShared(@Param('token') token: string, @Res() response: Response): Promise<void> {
    const doc = await this.plans.readShared(token);
    const { exportPlanToZip } = await import('@schematic/exporter');
    response.setHeader('Content-Type', 'application/zip');
    response.setHeader('Content-Disposition', `attachment; filename="${exportFileName(doc)}"`);
    response.end(Buffer.from(await exportPlanToZip(doc)));
  }
}
