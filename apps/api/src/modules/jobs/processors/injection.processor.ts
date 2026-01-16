import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SalesforceService } from '../../salesforce/salesforce.service';
import { DatasetsService } from '../../datasets/datasets.service';
import { DatasetStatus } from '../../datasets/entities/dataset.entity';
import { RecordStatus } from '../../datasets/entities/dataset-record.entity';
import { InjectionJobData } from '../services/queue.service';
import { JobsService } from '../jobs.service';
import { JobStatus } from '../entities/job.entity';

@Processor('injection')
export class InjectionProcessor extends WorkerHost {
  private readonly logger = new Logger(InjectionProcessor.name);

  constructor(
    private salesforceService: SalesforceService,
    private datasetsService: DatasetsService,
    private eventEmitter: EventEmitter2,
    private jobsService: JobsService,
  ) {
    super();
  }

  async process(job: Job<InjectionJobData>): Promise<{ successful: number; failed: number; total: number }> {
    const { datasetId, environmentId } = job.data;
    this.logger.log(`Starting injection job ${job.id} for dataset ${datasetId}`);

    try {
      await job.updateProgress(0);
      const queueJobId = String(job.id);
      const ensureNotCancelled = async () => {
        const current = await this.jobsService.findByQueue('injection', queueJobId);
        if (current?.status === JobStatus.CANCELLED) {
          throw new Error('Job cancelled');
        }
      };

      // Update dataset status
      await this.datasetsService.updateStatus(datasetId, DatasetStatus.INJECTING);

      // Get all generated records
      const records = await this.datasetsService.getRecords(datasetId);

      const totalRecords = records.length;

      // Inject records into Salesforce
      await ensureNotCancelled();

      const result = await this.salesforceService.injectRecords(
        environmentId,
        records.map((r) => ({
          id: r.id,
          salesforceObject: r.salesforceObject,
          localId: r.localId,
          parentLocalId: r.parentLocalId || undefined,
          data: r.data,
        })),
        {
          onProgress: async (processed, total) => {
            await ensureNotCancelled();
            if (total === 0) {
              return;
            }
            const progress = Math.min(95, Math.floor((processed / total) * 100));
            await job.updateProgress(progress);
          },
        },
      );

      // Update individual record statuses
      for (const success of result.success) {
        await this.datasetsService.updateRecordSalesforceId(
          datasetId,
          success.localId,
          success.salesforceId,
        );
      }

      for (const failure of result.failed) {
        await this.datasetsService.updateRecordStatus(
          failure.localId,
          RecordStatus.FAILED,
          undefined,
          failure.error,
        );
      }

      if (totalRecords === 0) {
        await job.updateProgress(95);
      }

      // Update dataset status
      if (result.summary.failed === 0) {
        await this.datasetsService.updateStatus(datasetId, DatasetStatus.COMPLETED);
      } else if (result.summary.successful > 0) {
        // Partial success - still mark as completed but with note
        await this.datasetsService.update(datasetId, {
          status: DatasetStatus.COMPLETED,
          errorMessage: `${result.summary.failed} records failed to inject`,
        });
      } else {
        await this.datasetsService.updateStatus(
          datasetId,
          DatasetStatus.FAILED,
          'All records failed to inject',
        );
      }

      await job.updateProgress(100);

      this.eventEmitter.emit('injection.completed', {
        datasetId,
        jobId: job.id,
        result: result.summary,
      });

      this.logger.log(
        `Injection completed for dataset ${datasetId}: ${result.summary.successful} success, ${result.summary.failed} failed`,
      );
      return result.summary;
    } catch (error: any) {
      this.logger.error(`Injection failed for dataset ${datasetId}: ${error.message}`);
      await this.datasetsService.updateStatus(datasetId, DatasetStatus.FAILED, error.message);
      throw error;
    }
  }

  @OnWorkerEvent('active')
  async onActive(job: Job) {
    this.logger.log(`Processing injection job ${job.id}`);
    await this.jobsService.markProcessing('injection', String(job.id), job.attemptsMade);
  }

  @OnWorkerEvent('completed')
  async onCompleted(job: Job) {
    this.logger.log(`Completed injection job ${job.id}`);
    await this.jobsService.markCompleted('injection', String(job.id), {
      datasetId: job.data?.datasetId,
      result: job.returnvalue,
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, err: Error) {
    this.logger.error(`Failed injection job ${job.id}: ${err.message}`);
    await this.jobsService.markFailed('injection', String(job.id), err.message);
  }

  @OnWorkerEvent('progress')
  async onProgress(job: Job, progress: number) {
    this.logger.debug(`Injection job ${job.id} progress: ${progress}%`);
    await this.jobsService.updateProgress('injection', String(job.id), progress);
  }
}
