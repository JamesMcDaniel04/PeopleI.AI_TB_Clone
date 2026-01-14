import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Dataset } from '../../datasets/entities/dataset.entity';

export enum JobType {
  DATA_GENERATION = 'data_generation',
  DATA_INJECTION = 'data_injection',
  CLEANUP = 'cleanup',
}

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('jobs')
@Index(['status', 'scheduledFor'])
@Index(['type', 'status'])
@Index(['queueName', 'queueJobId'])
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: JobType,
  })
  type: JobType;

  @Column({ name: 'queue_name', nullable: true })
  queueName: string;

  @Column({ name: 'queue_job_id', nullable: true })
  queueJobId: string;

  @Column({
    type: 'enum',
    enum: JobStatus,
    default: JobStatus.PENDING,
  })
  status: JobStatus;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'dataset_id', nullable: true })
  datasetId: string;

  @ManyToOne(() => Dataset, { nullable: true })
  @JoinColumn({ name: 'dataset_id' })
  dataset: Dataset;

  @Column({ type: 'jsonb', default: {} })
  payload: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, any>;

  @Column({ name: 'error_message', nullable: true })
  errorMessage: string;

  @Column({ default: 0 })
  attempts: number;

  @Column({ name: 'max_attempts', default: 3 })
  maxAttempts: number;

  @Column({ default: 0 })
  priority: number;

  @Column({ default: 0 })
  progress: number;

  @Column({ name: 'scheduled_for', default: () => 'CURRENT_TIMESTAMP' })
  scheduledFor: Date;

  @Column({ name: 'started_at', nullable: true })
  startedAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
