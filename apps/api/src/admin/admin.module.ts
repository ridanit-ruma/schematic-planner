import { Module } from '@nestjs/common';

import { PlansModule } from '../plans/plans.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { InstanceOwnerGuard } from './instance-owner.guard.js';

@Module({
  // PlansModule for CollabService: what is open right now is held by that
  // process, and it is the only thing that knows.
  imports: [PlansModule],
  controllers: [AdminController],
  providers: [AdminService, InstanceOwnerGuard],
})
export class AdminModule {}
