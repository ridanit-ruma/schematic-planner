import { Module } from '@nestjs/common';

import { PrismaModule } from '../common/prisma.module.js';
import { TrashController } from './trash.controller.js';
import { TrashService } from './trash.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [TrashController],
  providers: [TrashService],
})
export class TrashModule {}
