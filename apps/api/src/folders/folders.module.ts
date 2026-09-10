import { Global, Module } from '@nestjs/common';

import { FoldersController } from './folders.controller.js';
import { FoldersService } from './folders.service.js';

@Global()
@Module({
  controllers: [FoldersController],
  providers: [FoldersService],
  exports: [FoldersService],
})
export class FoldersModule {}
