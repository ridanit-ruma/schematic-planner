import { Global, Module } from '@nestjs/common';

import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';
import { VocabularyController } from './vocabulary.controller.js';
import { VocabularyService } from './vocabulary.service.js';

@Global()
@Module({
  controllers: [ProjectsController, VocabularyController],
  providers: [ProjectsService, VocabularyService],
  exports: [ProjectsService, VocabularyService],
})
export class ProjectsModule {}
