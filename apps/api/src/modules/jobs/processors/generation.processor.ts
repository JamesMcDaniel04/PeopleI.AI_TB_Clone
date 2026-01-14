import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GeneratorService } from '../../generator/generator.service';
import { DatasetsService } from '../../datasets/datasets.service';
import { DatasetStatus } from '../../datasets/entities/dataset.entity';
import { GenerationJobData } from '../services/queue.service';
import { JobsService } from '../jobs.service';

@Processor('generation')
export class GenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(GenerationProcessor.name);

  constructor(
    @Inject(forwardRef(() => GeneratorService))
    private generatorService: GeneratorService,
    private datasetsService: DatasetsService,
    private eventEmitter: EventEmitter2,
    private jobsService: JobsService,
  ) {
    super();
  }

  async process(job: Job<GenerationJobData>): Promise<void> {
    const { datasetId } = job.data;
    this.logger.log(`Starting generation job ${job.id} for dataset ${datasetId}`);

    try {
      await job.updateProgress(0);

      // Execute the generation
      await this.generatorService.executeGeneration(datasetId);

      await job.updateProgress(100);

      this.eventEmitter.emit('generation.completed', { datasetId, jobId: job.id });
      this.logger.log(`Generation completed for dataset ${datasetId}`);
    } catch (error: any) {
      this.logger.error(`Generation failed for dataset ${datasetId}: ${error.message}`);
      await this.datasetsService.updateStatus(datasetId, DatasetStatus.FAILED, error.message);
      throw error;
    }
  }

  @OnWorkerEvent('active')
  async onActive(job: Job) {
    this.logger.log(`Processing generation job ${job.id}`);
    await this.jobsService.markProcessing('generation', String(job.id), job.attemptsMade);
  }

  @OnWorkerEvent('completed')
  async onCompleted(job: Job) {
    this.logger.log(`Completed generation job ${job.id}`);
    await this.jobsService.markCompleted('generation', String(job.id), {
      datasetId: job.data?.datasetId,
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, err: Error) {
    this.logger.error(`Failed generation job ${job.id}: ${err.message}`);
    await this.jobsService.markFailed('generation', String(job.id), err.message);
  }

  @OnWorkerEvent('progress')
  async onProgress(job: Job, progress: number) {
    this.logger.debug(`Generation job ${job.id} progress: ${progress}%`);
    await this.jobsService.updateProgress('generation', String(job.id), progress);
  }
}
