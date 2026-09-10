import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../auth/auth.types.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { AdminService } from './admin.service.js';
import { InstanceOwnerGuard } from './instance-owner.guard.js';
import {
  createInviteSchema,
  updateAccountSchema,
  type CreateInviteInput,
  type UpdateAccountInput,
} from './admin.dto.js';

/** Everything about the instance rather than about a workspace. Owner only. */
@Controller('admin')
@UseGuards(InstanceOwnerGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('usage')
  usage() {
    return this.admin.usage();
  }

  @Get('invites')
  invites() {
    return this.admin.listInvites();
  }

  /** The token comes back once. Only its hash is kept. */
  @Post('invites')
  createInvite(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createInviteSchema)) body: CreateInviteInput,
  ) {
    return this.admin.createInvite(user.id, body);
  }

  @Delete('invites/:id')
  revokeInvite(@Param('id') id: string) {
    return this.admin.revokeInvite(id);
  }

  @Get('accounts')
  accounts() {
    return this.admin.listAccounts();
  }

  @Patch('accounts/:id')
  updateAccount(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(updateAccountSchema)) body: UpdateAccountInput,
  ) {
    return this.admin.updateAccount(user.id, id, body);
  }
}
