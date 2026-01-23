import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Environment } from '../../environments/entities/environment.entity';

export enum SnapshotStatus {
  CREATING = 'creating',
  READY = 'ready',
  RESTORING = 'restoring',
  FAILED = 'failed',
  ARCHIVED = 'archived',
}

export enum SnapshotType {
  MANUAL = 'manual',
  AUTO = 'auto',
  PRE_INJECTION = 'pre_injection',
  GOLDEN_IMAGE = 'golden_image',
}

@Entity('snapshots')
export class Snapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'environment_id' })
  environmentId: string;

  @ManyToOne(() => Environment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'environment_id' })
  environment: Environment;

  @Column({
    type: 'enum',
    enum: SnapshotStatus,
    default: SnapshotStatus.CREATING,
  })
  status: SnapshotStatus;

  @Column({
    type: 'enum',
    enum: SnapshotType,
    default: SnapshotType.MANUAL,
  })
  type: SnapshotType;

  @Column({ name: 'is_golden_image', default: false })
  isGoldenImage: boolean;

  // Stores the record IDs organized by object type
  @Column({ type: 'jsonb', name: 'record_ids', default: {} })
  recordIds: Record<string, string[]>;

  // Stores full record data for complete restoration
  @Column({ type: 'jsonb', name: 'record_data', default: {} })
  recordData: Record<string, Record<string, any>[]>;

  // Metadata about the snapshot
  @Column({ type: 'jsonb', default: {} })
  metadata: {
    totalRecords?: number;
    objectCounts?: Record<string, number>;
    salesforceOrgId?: string;
    createdBy?: string;
    tags?: string[];
    expiresAt?: string;
  };

  @Column({ name: 'size_bytes', type: 'bigint', default: 0 })
  sizeBytes: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'restored_at', type: 'timestamp', nullable: true })
  restoredAt: Date;

  @Column({ name: 'restore_count', default: 0 })
  restoreCount: number;
}
