import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { PlansModule } from '../plans/plans.module.js';
import { McpController } from './mcp.controller.js';
import { McpFactory } from './mcp.factory.js';

@Module({
  imports: [AuthModule, PlansModule],
  controllers: [McpController],
  providers: [McpFactory],
})
export class McpModule {}
