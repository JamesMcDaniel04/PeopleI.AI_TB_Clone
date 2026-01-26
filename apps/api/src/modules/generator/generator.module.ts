import { Module } from '@nestjs/common';
import { GeneratorController } from './generator.controller';
import { GeneratorService } from './generator.service';
import { OpenAIService } from './services/openai.service';
import { PromptBuilderService } from './services/prompt-builder.service';
import { DataTransformerService } from './services/data-transformer.service';
import { TemporalSchedulerService } from './services/temporal-scheduler.service';
import { CustomObjectGeneratorService } from './services/custom-object-generator.service';
import { MeetingTranscriptGeneratorService } from './services/meeting-transcript-generator.service';
import { TemplatesModule } from '../templates/templates.module';
import { DatasetsModule } from '../datasets/datasets.module';
import { SalesforceModule } from '../salesforce/salesforce.module';

@Module({
  imports: [TemplatesModule, DatasetsModule, SalesforceModule],
  controllers: [GeneratorController],
  providers: [
    GeneratorService,
    OpenAIService,
    PromptBuilderService,
    DataTransformerService,
    TemporalSchedulerService,
    CustomObjectGeneratorService,
    MeetingTranscriptGeneratorService,
  ],
  exports: [
    GeneratorService,
    OpenAIService,
    PromptBuilderService,
    DataTransformerService,
    TemporalSchedulerService,
    CustomObjectGeneratorService,
    MeetingTranscriptGeneratorService,
  ],
})
export class GeneratorModule {}
