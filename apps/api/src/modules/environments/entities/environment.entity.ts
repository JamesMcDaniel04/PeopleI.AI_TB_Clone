import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { SalesforceCredential } from './salesforce-credential.entity';
import { Dataset } from '../../datasets/entities/dataset.entity';

export enum EnvironmentStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

export interface EnvironmentInjectionConfig {
  recordTypeOverrides?: Record<string, string>;
  fieldMappings?: Record<string, Record<string, string>>;
  fieldDefaults?: Record<string, Record<string, any>>;
}

@Entity('environments')
export class Environment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.environments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'injection_config', type: 'jsonb', default: {} })
  injectionConfig: EnvironmentInjectionConfig;

  @Column({ name: 'salesforce_instance_url', nullable: true })
  salesforceInstanceUrl: string;

  @Column({ name: 'salesforce_org_id', nullable: true })
  salesforceOrgId: string;

  @Column({ name: 'is_sandbox', default: true })
  isSandbox: boolean;

  @Column({
    type: 'enum',
    enum: EnvironmentStatus,
    default: EnvironmentStatus.DISCONNECTED,
  })
  status: EnvironmentStatus;

  @Column({ name: 'last_synced_at', nullable: true })
  lastSyncedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => SalesforceCredential, (credential) => credential.environment, {
    cascade: true,
  })
  credential: SalesforceCredential;

  @OneToMany(() => Dataset, (dataset) => dataset.environment)
  datasets: Dataset[];
}
