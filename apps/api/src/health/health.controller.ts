import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

import { PrismaService } from '../common/prisma.service.js';
import { Public } from '../auth/public.decorator.js';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: the process is up. Deliberately touches nothing else. */
  @Public()
  @Get('healthz')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Readiness: this instance can serve traffic, which means the database answers. */
  @Public()
  @Get('readyz')
  async ready(): Promise<{ status: 'ok' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'database unavailable' });
    }
    return { status: 'ok' };
  }
}
