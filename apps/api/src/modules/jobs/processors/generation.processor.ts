import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GeneratorService } from '../../generator/generator.service';
import { DatasetsService } from '../../datasets/datasets.service';
import { DatasetStatus } from '../../datasets/entities/dataset.entity';
import { GenerationJobData } from '../services/queue.service';
import { JobsService } from '../jobs.service';
import { JobStatus } from '../entities/job.entity';
import { EventsGateway } from '../../websocket/events.gateway';

@Processor('generation')
export class GenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(GenerationProcessor.name);

  constructor(
    @Inject(forwardRef(() => GeneratorService))
    private generatorService: GeneratorService,
    private datasetsService: DatasetsService,
    private eventEmitter: EventEmitter2,
    private jobsService: JobsService,
    private eventsGateway: EventsGateway,
  ) {
    super();
  }

  async process(job: Job<GenerationJobData>): Promise<{ datasetId: string }> {
    const { datasetId, userId } = job.data;
    this.logger.log(`Starting generation job ${job.id} for dataset ${datasetId}`);

    try {
      await job.updateProgress(0);

      // Emit initial progress via WebSocket
      this.emitProgress(userId, datasetId, String(job.id), 'running', 0, 'Starting generation...');

      // Execute the generation
      const queueJobId = String(job.id);
      const shouldCancel = async () => {
        const current = await this.jobsService.findByQueue('generation', queueJobId);
        return current?.status === JobStatus.CANCELLED;
      };

      await this.generatorService.executeGeneration(
        datasetId,
        async (progress) => {
          await job.updateProgress(progress);
          // Emit progress via WebSocket
          this.emitProgress(userId, datasetId, queueJobId, 'running', progress, `Generating data... ${progress}%`);
        },
        shouldCancel,
      );

      await job.updateProgress(100);

      // Emit completion via WebSocket
      this.eventsGateway.emitJobCompleted(userId, {
        jobId: queueJobId,
        datasetId,
        type: 'generation',
        status: 'completed',
        progress: 100,
        message: 'Generation completed successfully',
      });

      this.eventEmitter.emit('generation.completed', { datasetId, jobId: job.id });
      this.logger.log(`Generation completed for dataset ${datasetId}`);
      return { datasetId };
    } catch (error: any) {
      this.logger.error(`Generation failed for dataset ${datasetId}: ${error.message}`);

      // Emit failure via WebSocket
      this.eventsGateway.emitJobFailed(userId, {
        jobId: String(job.id),
        datasetId,
        type: 'generation',
        status: 'failed',
        progress: 0,
        message: 'Generation failed',
        error: error.message,
      });

      await this.datasetsService.updateStatus(datasetId, DatasetStatus.FAILED, error.message);
      throw error;
    }
  }

  private emitProgress(
    userId: string,
    datasetId: string,
    jobId: string,
    status: 'pending' | 'running' | 'completed' | 'failed',
    progress: number,
    message?: string,
  ) {
    this.eventsGateway.emitJobProgress(userId, {
      jobId,
      datasetId,
      type: 'generation',
      status,
      progress,
      message,
    });
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
      result: job.returnvalue,
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
