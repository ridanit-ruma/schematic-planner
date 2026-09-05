import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { CollabGateway } from '../collab/collab.gateway.js';
import { CollabService } from '../collab/collab.service.js';
import { PlanDocumentsService } from './plan-documents.service.js';
import { PlansController } from './plans.controller.js';
import { PlansService } from './plans.service.js';

/**
 * Plans and collaboration ship together on purpose: they are two views of one
 * document, and separating them would only create a cycle between the modules.
 */
@Module({
  // AuthModule for JwtService: the collaboration socket verifies the same
  // access token the REST API does.
  imports: [AuthModule],
  controllers: [PlansController],
  providers: [PlansService, PlanDocumentsService, CollabService, CollabGateway],
  exports: [PlansService, CollabService, PlanDocumentsService],
})
export class PlansModule {}
