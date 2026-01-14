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
    await this.jobsRepository.update(
      { queueName, queueJobId },
      {
        status: JobStatus.PROCESSING,
        attempts: attempts ?? 0,
        startedAt: new Date(),
      },
    );
  }

  async markCompleted(
    queueName: string,
    queueJobId: string,
    result?: Record<string, any>,
  ): Promise<void> {
    await this.jobsRepository.update(
      { queueName, queueJobId },
      {
        status: JobStatus.COMPLETED,
        result: result ?? {},
        progress: 100,
        completedAt: new Date(),
      },
    );
  }

  async markFailed(
    queueName: string,
    queueJobId: string,
    errorMessage: string,
  ): Promise<void> {
    await this.jobsRepository.update(
      { queueName, queueJobId },
      {
        status: JobStatus.FAILED,
        errorMessage,
        completedAt: new Date(),
      },
    );
  }

  async updateProgress(queueName: string, queueJobId: string, progress: number): Promise<void> {
    await this.jobsRepository.update(
      { queueName, queueJobId },
      {
        progress,
      },
    );
  }

  async findById(jobId: string): Promise<Job | null> {
    return this.jobsRepository.findOne({ where: { id: jobId } });
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
