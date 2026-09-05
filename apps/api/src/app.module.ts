import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt.guard.js';
import { PrismaModule } from './common/prisma.module.js';
import { ConfigModule } from './config/config.module.js';
import { HealthModule } from './health/health.module.js';
import { McpModule } from './mcp/mcp.module.js';
import { PlansModule } from './plans/plans.module.js';
import { WorkspacesModule } from './workspaces/workspaces.module.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    WorkspacesModule,
    PlansModule,
    McpModule,
    HealthModule,
  ],
  providers: [
    // Applied to every route, so a new endpoint is protected unless it opts out
    // with @Public(). The opposite default fails silently.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
