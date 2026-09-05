import { Global, Module } from '@nestjs/common';

import { AccessService } from './access.service.js';
import { WorkspacesController } from './workspaces.controller.js';
import { WorkspacesService } from './workspaces.service.js';

@Global()
@Module({
  controllers: [WorkspacesController],
  providers: [AccessService, WorkspacesService],
  exports: [AccessService],
})
export class WorkspacesModule {}
