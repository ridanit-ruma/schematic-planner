import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, Reflector } from '@nestjs/core';
import { ThrottlerModule, type ThrottlerModuleOptions } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt.guard.js';
import { PlanOpExceptionFilter } from './common/plan-op.filter.js';
import { ApiThrottlerGuard, IS_STRICT_RATE_LIMIT } from './common/throttle.js';
import { PrismaModule } from './common/prisma.module.js';
import { ConfigModule } from './config/config.module.js';
import { APP_CONFIG, type AppConfig } from './config/env.js';
import { HealthModule } from './health/health.module.js';
import { McpModule } from './mcp/mcp.module.js';
import { PlansModule } from './plans/plans.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { WorkspacesModule } from './workspaces/workspaces.module.js';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      // ConfigModule is global, so nothing needs importing here.
      imports: [],
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): ThrottlerModuleOptions => {
        const ttl = config.rateLimit.windowSeconds * 1000;
        // Reflector is a stateless metadata reader, so the factory can hold its
        // own rather than waiting on injection.
        const reflector = new Reflector();

        return {
          throttlers: [
            { name: 'default', ttl, limit: config.rateLimit.max },
            {
              name: 'strict',
              ttl,
              limit: config.rateLimit.authMax,
              skipIf: (context) =>
                reflector.getAllAndOverride<boolean>(IS_STRICT_RATE_LIMIT, [
                  context.getHandler(),
                  context.getClass(),
                ]) !== true,
            },
          ],
        };
      },
    }),
    PrismaModule,
    AuthModule,
    WorkspacesModule,
    ProjectsModule,
    PlansModule,
    McpModule,
    HealthModule,
  ],
  providers: [
    // Applied to every route, so a new endpoint is protected unless it opts out
    // with @Public(). The opposite default fails silently.
    // Rate limiting runs first: an unauthenticated flood should be turned away
    // before it reaches the database to check a password.
    { provide: APP_GUARD, useClass: ApiThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: PlanOpExceptionFilter },
  ],
})
export class AppModule {}
