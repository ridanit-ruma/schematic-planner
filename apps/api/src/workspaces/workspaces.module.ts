import { Global, Module } from '@nestjs/common';

import { PlansModule } from '../plans/plans.module.js';
import { AccessService } from './access.service.js';
import { WorkspacesController } from './workspaces.controller.js';
import { WorkspacesService } from './workspaces.service.js';

@Global()
@Module({
  // PlansModule for CollabService: taking somebody's access away has to reach
  // the sockets they are already holding, and that process is the only thing
  // that knows what those are.
  imports: [PlansModule],
  controllers: [WorkspacesController],
  providers: [AccessService, WorkspacesService],
  exports: [AccessService, WorkspacesService],
})
export class WorkspacesModule {}
