import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { JobsService } from '../jobs.service';
import { JobType, JobStatus } from '../entities/job.entity';

export interface GenerationJobData {
  datasetId: string;
  userId: string;
}

export interface InjectionJobData {
  datasetId: string;
  environmentId: string;
  userId: string;
}

export interface CleanupJobData {
  datasetId: string;
  environmentId: string;
  userId: string;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('generation') private generationQueue: Queue<GenerationJobData>,
    @InjectQueue('injection') private injectionQueue: Queue<InjectionJobData>,
    @InjectQueue('cleanup') private cleanupQueue: Queue<CleanupJobData>,
    private jobsService: JobsService,
  ) {}

  private getQueueByName(queueName: string): Queue<any> | null {
    switch (queueName) {
      case 'generation':
        return this.generationQueue;
      case 'injection':
        return this.injectionQueue;
      case 'cleanup':
        return this.cleanupQueue;
      default:
        return null;
    }
  }

  async addGenerationJob(data: GenerationJobData): Promise<Job<GenerationJobData>> {
    this.logger.log(`Adding generation job for dataset ${data.datasetId}`);

    const job = await this.generationQueue.add('generate', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 500,
    });

    await this.jobsService.createJob({
      type: JobType.DATA_GENERATION,
      status: JobStatus.PENDING,
      userId: data.userId,
      datasetId: data.datasetId,
      payload: data,
      queueName: 'generation',
      queueJobId: String(job.id),
      maxAttempts: 3,
    });

    return job;
  }

  async addInjectionJob(data: InjectionJobData): Promise<Job<InjectionJobData>> {
    this.logger.log(`Adding injection job for dataset ${data.datasetId}`);

    const job = await this.injectionQueue.add('inject', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 500,
    });

    await this.jobsService.createJob({
      type: JobType.DATA_INJECTION,
      status: JobStatus.PENDING,
      userId: data.userId,
      datasetId: data.datasetId,
      payload: data,
      queueName: 'injection',
      queueJobId: String(job.id),
      maxAttempts: 3,
    });

    return job;
  }

  async addCleanupJob(data: CleanupJobData): Promise<Job<CleanupJobData>> {
    this.logger.log(`Adding cleanup job for dataset ${data.datasetId}`);

    const job = await this.cleanupQueue.add('cleanup', data, {
      attempts: 2,
      backoff: {
        type: 'fixed',
        delay: 3000,
      },
      removeOnComplete: 50,
      removeOnFail: 100,
    });

    await this.jobsService.createJob({
      type: JobType.CLEANUP,
      status: JobStatus.PENDING,
      userId: data.userId,
      datasetId: data.datasetId,
      payload: data,
      queueName: 'cleanup',
      queueJobId: String(job.id),
      maxAttempts: 2,
    });

    return job;
  }

  async getGenerationJobStatus(jobId: string): Promise<{
    status: string;
    progress: number;
    data?: any;
    error?: string;
  } | null> {
    const job = await this.generationQueue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress as number;

    return {
      status: state,
      progress: typeof progress === 'number' ? progress : 0,
      data: job.returnvalue,
      error: job.failedReason,
    };
  }

  async getInjectionJobStatus(jobId: string): Promise<{
    status: string;
    progress: number;
    data?: any;
    error?: string;
  } | null> {
    const job = await this.injectionQueue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress as number;

    return {
      status: state,
      progress: typeof progress === 'number' ? progress : 0,
      data: job.returnvalue,
      error: job.failedReason,
    };
  }

  async cancelGenerationJob(jobId: string): Promise<boolean> {
    const job = await this.generationQueue.getJob(jobId);
    if (!job) {
      return false;
    }

    const state = await job.getState();
    if (state === 'active') {
      // Can't cancel active jobs directly
      return false;
    }

    await job.remove();
    return true;
  }

  async cancelJob(
    queueName: string,
    queueJobId: string,
  ): Promise<{ cancelled: boolean; state?: string }> {
    const queue = this.getQueueByName(queueName);
    if (!queue) {
      return { cancelled: false };
    }

    const job = await queue.getJob(queueJobId);
    if (!job) {
      return { cancelled: false };
    }

    const state = await job.getState();
    if (state === 'completed' || state === 'failed') {
      return { cancelled: false, state };
    }

    if (state !== 'active') {
      await job.remove();
    }

    return { cancelled: true, state };
  }

  async getQueueMetrics(): Promise<Record<string, any>> {
    const queues = ['generation', 'injection', 'cleanup'];
    const metrics: Record<string, any> = {};

    for (const queueName of queues) {
      const queue = this.getQueueByName(queueName);
      if (!queue) {
        continue;
      }

      const counts = await queue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
      );
      metrics[queueName] = counts;
    }

    return metrics;
  }
}
