import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';

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
  ) {}

  async addGenerationJob(data: GenerationJobData): Promise<Job<GenerationJobData>> {
    this.logger.log(`Adding generation job for dataset ${data.datasetId}`);

    return this.generationQueue.add('generate', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  }

  async addInjectionJob(data: InjectionJobData): Promise<Job<InjectionJobData>> {
    this.logger.log(`Adding injection job for dataset ${data.datasetId}`);

    return this.injectionQueue.add('inject', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  }

  async addCleanupJob(data: CleanupJobData): Promise<Job<CleanupJobData>> {
    this.logger.log(`Adding cleanup job for dataset ${data.datasetId}`);

    return this.cleanupQueue.add('cleanup', data, {
      attempts: 2,
      backoff: {
        type: 'fixed',
        delay: 3000,
      },
      removeOnComplete: 50,
      removeOnFail: 100,
    });
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
}
