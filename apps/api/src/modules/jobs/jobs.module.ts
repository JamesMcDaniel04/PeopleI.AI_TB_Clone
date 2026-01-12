import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GenerationProcessor } from './processors/generation.processor';
import { InjectionProcessor } from './processors/injection.processor';
import { QueueService } from './services/queue.service';
import { Job } from './entities/job.entity';
import { DatasetsModule } from '../datasets/datasets.module';
import { SalesforceModule } from '../salesforce/salesforce.module';
import { GeneratorModule } from '../generator/generator.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Job]),
    BullModule.registerQueue(
      { name: 'generation' },
      { name: 'injection' },
      { name: 'cleanup' },
    ),
    forwardRef(() => DatasetsModule),
    forwardRef(() => SalesforceModule),
    forwardRef(() => GeneratorModule),
  ],
  providers: [
    QueueService,
    GenerationProcessor,
    InjectionProcessor,
  ],
  exports: [QueueService],
})
export class JobsModule {}
