import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Environment } from './environment.entity';

@Entity('salesforce_credentials')
export class SalesforceCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'environment_id', unique: true })
  environmentId: string;

  @OneToOne(() => Environment, (environment) => environment.credential, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'environment_id' })
  environment: Environment;

  @Column({ name: 'access_token_encrypted', type: 'text' })
  accessTokenEncrypted: string;

  @Column({ name: 'refresh_token_encrypted', type: 'text' })
  refreshTokenEncrypted: string;

  @Column({ name: 'token_expires_at', nullable: true })
  tokenExpiresAt: Date;

  @Column({ name: 'connected_user_email', nullable: true })
  connectedUserEmail: string;

  @Column({ name: 'connected_user_id', nullable: true })
  connectedUserId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
