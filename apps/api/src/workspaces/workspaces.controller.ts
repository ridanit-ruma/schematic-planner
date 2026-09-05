import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../auth/auth.types.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { WorkspacesService } from './workspaces.service.js';
import {
  createApiKeySchema,
  createInviteSchema,
  createWorkspaceSchema,
  updateMemberSchema,
  type CreateApiKeyInput,
  type CreateInviteInput,
  type CreateWorkspaceInput,
  type UpdateMemberInput,
} from './workspaces.dto.js';

@Controller()
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get('workspaces')
  list(@CurrentUser() user: AuthUser) {
    return this.workspaces.listForUser(user.id);
  }

  @Post('workspaces')
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createWorkspaceSchema)) body: CreateWorkspaceInput,
  ) {
    return this.workspaces.create(user.id, body);
  }

  @Get('workspaces/:id/members')
  members(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.workspaces.members(user.id, id);
  }

  @Patch('workspaces/:id/members/:userId')
  updateMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') memberId: string,
    @Body(new ZodPipe(updateMemberSchema)) body: UpdateMemberInput,
  ) {
    return this.workspaces.updateMember(user.id, id, memberId, body.role);
  }

  @Delete('workspaces/:id/members/:userId')
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') memberId: string,
  ) {
    return this.workspaces.removeMember(user.id, id, memberId);
  }

  @Post('workspaces/:id/invites')
  invite(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(createInviteSchema)) body: CreateInviteInput,
  ) {
    return this.workspaces.createInvite(user.id, id, body);
  }

  @Post('invites/:token/accept')
  accept(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.workspaces.acceptInvite(user.id, token);
  }

  @Get('workspaces/:id/api-keys')
  apiKeys(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.workspaces.listApiKeys(user.id, id);
  }

  @Post('workspaces/:id/api-keys')
  createApiKey(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(createApiKeySchema)) body: CreateApiKeyInput,
  ) {
    return this.workspaces.createApiKey(user.id, id, body);
  }

  @Delete('workspaces/:id/api-keys/:keyId')
  revokeApiKey(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('keyId') keyId: string,
  ) {
    return this.workspaces.revokeApiKey(user.id, id, keyId);
  }
}
