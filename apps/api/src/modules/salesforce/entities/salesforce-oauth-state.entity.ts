import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('salesforce_oauth_states')
@Index(['state'], { unique: true })
@Index(['expiresAt'])
export class SalesforceOAuthState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  state: string;

  @Column({ name: 'environment_id' })
  environmentId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'is_sandbox', default: true })
  isSandbox: boolean;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
