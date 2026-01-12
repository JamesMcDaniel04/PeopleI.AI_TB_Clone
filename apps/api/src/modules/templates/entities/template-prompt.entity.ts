import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Template } from './template.entity';

export enum SalesforceObject {
  ACCOUNT = 'Account',
  CONTACT = 'Contact',
  OPPORTUNITY = 'Opportunity',
  TASK = 'Task',
  EVENT = 'Event',
  EMAIL_MESSAGE = 'EmailMessage',
}

@Entity('template_prompts')
export class TemplatePrompt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'template_id' })
  templateId: string;

  @ManyToOne(() => Template, (template) => template.prompts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: Template;

  @Column({
    name: 'salesforce_object',
    type: 'enum',
    enum: SalesforceObject,
  })
  salesforceObject: SalesforceObject;

  @Column({ name: 'system_prompt', type: 'text' })
  systemPrompt: string;

  @Column({ name: 'user_prompt_template', type: 'text' })
  userPromptTemplate: string;

  @Column({ name: 'output_schema', type: 'jsonb', nullable: true })
  outputSchema: Record<string, any>;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.7 })
  temperature: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
