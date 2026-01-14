import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SalesforceService } from '../../salesforce/salesforce.service';
import { DatasetsService } from '../../datasets/datasets.service';
import { CleanupJobData } from '../services/queue.service';
import { JobsService } from '../jobs.service';

@Processor('cleanup')
export class CleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(CleanupProcessor.name);

  constructor(
    private salesforceService: SalesforceService,
    private datasetsService: DatasetsService,
    private eventEmitter: EventEmitter2,
    private jobsService: JobsService,
  ) {
    super();
  }

  async process(job: Job<CleanupJobData>): Promise<{ success: number; failed: number; successIds: string[]; failedIds: string[] }> {
    const { datasetId, environmentId } = job.data;
    this.logger.log(`Starting cleanup job ${job.id} for dataset ${datasetId}`);

    try {
      await job.updateProgress(0);

      const injectedRecords = await this.datasetsService.getInjectedRecords(datasetId);
      if (injectedRecords.length === 0) {
        await job.updateProgress(100);
        this.eventEmitter.emit('cleanup.completed', {
          datasetId,
          jobId: job.id,
          result: { deleted: 0, failed: 0 },
        });
        return { success: 0, failed: 0, successIds: [], failedIds: [] };
      }

      await job.updateProgress(10);

      const result = await this.salesforceService.cleanupRecords(
        environmentId,
        injectedRecords,
      );

      await job.updateProgress(90);

      if (result.successIds.length > 0) {
        await this.datasetsService.resetInjectedRecords(datasetId, result.successIds);
      }

      await job.updateProgress(100);

      this.eventEmitter.emit('cleanup.completed', {
        datasetId,
        jobId: job.id,
        result,
      });

      this.logger.log(
        `Cleanup completed for dataset ${datasetId}: ${result.success} success, ${result.failed} failed`,
      );
      return result;
    } catch (error: any) {
      this.logger.error(`Cleanup failed for dataset ${datasetId}: ${error.message}`);
      throw error;
    }
  }

  @OnWorkerEvent('active')
  async onActive(job: Job) {
    this.logger.log(`Processing cleanup job ${job.id}`);
    await this.jobsService.markProcessing('cleanup', String(job.id), job.attemptsMade);
  }

  @OnWorkerEvent('completed')
  async onCompleted(job: Job) {
    this.logger.log(`Completed cleanup job ${job.id}`);
    await this.jobsService.markCompleted('cleanup', String(job.id), {
      datasetId: job.data?.datasetId,
      result: job.returnvalue,
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, err: Error) {
    this.logger.error(`Failed cleanup job ${job.id}: ${err.message}`);
    await this.jobsService.markFailed('cleanup', String(job.id), err.message);
  }

  @OnWorkerEvent('progress')
  async onProgress(job: Job, progress: number) {
    this.logger.debug(`Cleanup job ${job.id} progress: ${progress}%`);
    await this.jobsService.updateProgress('cleanup', String(job.id), progress);
  }
}
