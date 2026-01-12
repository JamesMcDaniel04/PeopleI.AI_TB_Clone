import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Environment } from '../../environments/entities/environment.entity';
import { Template } from '../../templates/entities/template.entity';
import { DatasetRecord } from './dataset-record.entity';

export enum DatasetStatus {
  PENDING = 'pending',
  GENERATING = 'generating',
  GENERATED = 'generated',
  INJECTING = 'injecting',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('datasets')
export class Dataset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.datasets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'environment_id', nullable: true })
  environmentId: string;

  @ManyToOne(() => Environment, (environment) => environment.datasets, {
    nullable: true,
  })
  @JoinColumn({ name: 'environment_id' })
  environment: Environment;

  @Column({ name: 'template_id', nullable: true })
  templateId: string;

  @ManyToOne(() => Template, (template) => template.datasets, { nullable: true })
  @JoinColumn({ name: 'template_id' })
  template: Template;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: DatasetStatus,
    default: DatasetStatus.PENDING,
  })
  status: DatasetStatus;

  @Column({ type: 'jsonb', default: {} })
  config: {
    recordCounts?: {
      Account?: number;
      Contact?: number;
      Opportunity?: number;
      Task?: number;
      Event?: number;
    };
    scenario?: string;
    industry?: string;
  };

  @Column({ name: 'record_counts', type: 'jsonb', default: {} })
  recordCounts: Record<string, number>;

  @Column({ name: 'error_message', nullable: true })
  errorMessage: string;

  @Column({ name: 'started_at', nullable: true })
  startedAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => DatasetRecord, (record) => record.dataset, { cascade: true })
  records: DatasetRecord[];
}
