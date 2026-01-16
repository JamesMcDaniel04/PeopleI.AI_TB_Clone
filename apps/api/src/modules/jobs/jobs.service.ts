import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job, JobStatus, JobType } from './entities/job.entity';

interface CreateJobInput {
  type: JobType;
  status?: JobStatus;
  userId?: string;
  datasetId?: string;
  payload?: Record<string, any>;
  queueName?: string;
  queueJobId?: string;
  maxAttempts?: number;
  priority?: number;
}

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job)
    private jobsRepository: Repository<Job>,
  ) {}

  async createJob(input: CreateJobInput): Promise<Job> {
    const job = this.jobsRepository.create({
      status: JobStatus.PENDING,
      payload: {},
      maxAttempts: input.maxAttempts ?? 3,
      priority: input.priority ?? 0,
      ...input,
    });

    return this.jobsRepository.save(job);
  }

  async markProcessing(queueName: string, queueJobId: string, attempts?: number): Promise<void> {
    await this.jobsRepository
      .createQueryBuilder()
      .update(Job)
      .set({
        status: JobStatus.PROCESSING,
        attempts: attempts ?? 0,
        startedAt: new Date(),
      })
      .where('queue_name = :queueName', { queueName })
      .andWhere('queue_job_id = :queueJobId', { queueJobId })
      .andWhere('status != :cancelled', { cancelled: JobStatus.CANCELLED })
      .execute();
  }

  async markCompleted(
    queueName: string,
    queueJobId: string,
    result?: Record<string, any>,
  ): Promise<void> {
    await this.jobsRepository
      .createQueryBuilder()
      .update(Job)
      .set({
        status: JobStatus.COMPLETED,
        result: result ?? {},
        progress: 100,
        completedAt: new Date(),
      })
      .where('queue_name = :queueName', { queueName })
      .andWhere('queue_job_id = :queueJobId', { queueJobId })
      .andWhere('status != :cancelled', { cancelled: JobStatus.CANCELLED })
      .execute();
  }

  async markFailed(
    queueName: string,
    queueJobId: string,
    errorMessage: string,
  ): Promise<void> {
    await this.jobsRepository
      .createQueryBuilder()
      .update(Job)
      .set({
        status: JobStatus.FAILED,
        errorMessage,
        completedAt: new Date(),
      })
      .where('queue_name = :queueName', { queueName })
      .andWhere('queue_job_id = :queueJobId', { queueJobId })
      .andWhere('status != :cancelled', { cancelled: JobStatus.CANCELLED })
      .execute();
  }

  async updateProgress(queueName: string, queueJobId: string, progress: number): Promise<void> {
    await this.jobsRepository
      .createQueryBuilder()
      .update(Job)
      .set({ progress })
      .where('queue_name = :queueName', { queueName })
      .andWhere('queue_job_id = :queueJobId', { queueJobId })
      .andWhere('status != :cancelled', { cancelled: JobStatus.CANCELLED })
      .execute();
  }

  async markCancelled(queueName: string, queueJobId: string, reason?: string): Promise<void> {
    await this.jobsRepository.update(
      { queueName, queueJobId },
      {
        status: JobStatus.CANCELLED,
        errorMessage: reason || 'Cancelled by user',
        completedAt: new Date(),
      },
    );
  }

  async findById(jobId: string): Promise<Job | null> {
    return this.jobsRepository.findOne({ where: { id: jobId } });
  }

  async findByQueue(queueName: string, queueJobId: string): Promise<Job | null> {
    return this.jobsRepository.findOne({
      where: { queueName, queueJobId },
    });
  }

  async findForUser(
    userId: string,
    filters?: { datasetId?: string; type?: JobType; status?: JobStatus; limit?: number },
  ): Promise<Job[]> {
    const query = this.jobsRepository
      .createQueryBuilder('job')
      .where('job.userId = :userId', { userId })
      .orderBy('job.createdAt', 'DESC');

    if (filters?.datasetId) {
      query.andWhere('job.datasetId = :datasetId', { datasetId: filters.datasetId });
    }

    if (filters?.type) {
      query.andWhere('job.type = :type', { type: filters.type });
    }

    if (filters?.status) {
      query.andWhere('job.status = :status', { status: filters.status });
    }

    if (filters?.limit) {
      query.take(filters.limit);
    }

    return query.getMany();
  }
}
