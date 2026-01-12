import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Dataset } from './dataset.entity';

export enum RecordStatus {
  GENERATED = 'generated',
  INJECTING = 'injecting',
  INJECTED = 'injected',
  FAILED = 'failed',
}

@Entity('dataset_records')
@Index(['datasetId', 'salesforceObject'])
@Index(['localId'])
export class DatasetRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'dataset_id' })
  datasetId: string;

  @ManyToOne(() => Dataset, (dataset) => dataset.records, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dataset_id' })
  dataset: Dataset;

  @Column({ name: 'salesforce_object' })
  salesforceObject: string;

  @Column({ name: 'local_id' })
  localId: string;

  @Column({ name: 'salesforce_id', nullable: true, length: 18 })
  salesforceId: string;

  @Column({ type: 'jsonb' })
  data: Record<string, any>;

  @Column({
    type: 'enum',
    enum: RecordStatus,
    default: RecordStatus.GENERATED,
  })
  status: RecordStatus;

  @Column({ name: 'parent_local_id', nullable: true })
  parentLocalId: string;

  @Column({ name: 'error_message', nullable: true })
  errorMessage: string;

  @Column({ name: 'injected_at', nullable: true })
  injectedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
