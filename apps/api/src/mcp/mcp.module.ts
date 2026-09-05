import { Module } from '@nestjs/common';

import { PlansModule } from '../plans/plans.module.js';
import { ApiKeyService } from './api-key.service.js';
import { McpController } from './mcp.controller.js';
import { McpFactory } from './mcp.factory.js';

@Module({
  imports: [PlansModule],
  controllers: [McpController],
  providers: [ApiKeyService, McpFactory],
})
export class McpModule {}
