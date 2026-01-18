import { Module, forwardRef, DynamicModule, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GenerationProcessor } from './processors/generation.processor';
import { InjectionProcessor } from './processors/injection.processor';
import { CleanupProcessor } from './processors/cleanup.processor';
import { QueueService } from './services/queue.service';
import { Job } from './entities/job.entity';
import { DatasetsModule } from '../datasets/datasets.module';
import { SalesforceModule } from '../salesforce/salesforce.module';
import { GeneratorModule } from '../generator/generator.module';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { JobsCleanupService } from './jobs-cleanup.service';

interface JobsModuleOptions {
  processors?: boolean;
  controllers?: boolean;
}

@Global()
@Module({})
export class JobsModule {
  static register(options: JobsModuleOptions = {}): DynamicModule {
    const providers = [QueueService, JobsService];
    const controllers = options.controllers ? [JobsController] : [];

    if (options.processors) {
      providers.push(GenerationProcessor, InjectionProcessor, CleanupProcessor);
      providers.push(JobsCleanupService);
    }

    const imports = [
      TypeOrmModule.forFeature([Job]),
      BullModule.registerQueue(
        { name: 'generation' },
        { name: 'injection' },
        { name: 'cleanup' },
      ),
    ];

    if (options.processors || options.controllers) {
      imports.push(forwardRef(() => DatasetsModule));
    }

    if (options.processors) {
      imports.push(forwardRef(() => SalesforceModule), forwardRef(() => GeneratorModule));
    }

    return {
      module: JobsModule,
      imports,
      controllers,
      providers,
      exports: [QueueService, JobsService],
    };
  }
}
