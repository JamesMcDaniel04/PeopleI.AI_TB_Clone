import { Module } from '@nestjs/common';
import { GeneratorController } from './generator.controller';
import { GeneratorService } from './generator.service';
import { OpenAIService } from './services/openai.service';
import { PromptBuilderService } from './services/prompt-builder.service';
import { DataTransformerService } from './services/data-transformer.service';
import { TemplatesModule } from '../templates/templates.module';
import { DatasetsModule } from '../datasets/datasets.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [TemplatesModule, DatasetsModule, JobsModule],
  controllers: [GeneratorController],
  providers: [
    GeneratorService,
    OpenAIService,
    PromptBuilderService,
    DataTransformerService,
  ],
  exports: [GeneratorService, OpenAIService, PromptBuilderService, DataTransformerService],
})
export class GeneratorModule {}
