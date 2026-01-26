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
import { TemplatePrompt } from './template-prompt.entity';
import { Dataset } from '../../datasets/entities/dataset.entity';

export enum TemplateCategory {
  SALES_SCENARIO = 'sales_scenario',
  INDUSTRY_VERTICAL = 'industry_vertical',
  CUSTOM = 'custom',
}

export enum Industry {
  TECHNOLOGY = 'technology',
  HEALTHCARE = 'healthcare',
  FINANCE = 'finance',
  MANUFACTURING = 'manufacturing',
  RETAIL = 'retail',
  GENERAL = 'general',
}

@Entity('templates')
export class Template {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: TemplateCategory,
    default: TemplateCategory.SALES_SCENARIO,
  })
  category: TemplateCategory;

  @Column({
    type: 'enum',
    enum: Industry,
    default: Industry.GENERAL,
  })
  industry: Industry;

  @Column({ name: 'is_system', default: false })
  isSystem: boolean;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @ManyToOne(() => User, (user) => user.templates, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'jsonb', default: {} })
  config: {
    defaultRecordCounts?: {
      Account?: number;
      Contact?: number;
      Lead?: number;
      Opportunity?: number;
      Case?: number;
      Campaign?: number;
      CampaignMember?: number;
      Task?: number;
      Event?: number;
      EmailMessage?: number;
      [key: string]: number | undefined;
    };
    scenarios?: string[];
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => TemplatePrompt, (prompt) => prompt.template, { cascade: true })
  prompts: TemplatePrompt[];

  @OneToMany(() => Dataset, (dataset) => dataset.template)
  datasets: Dataset[];
}
