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

export interface RecordCounts {
  Account?: number;
  Contact?: number;
  Opportunity?: number;
  Task?: number;
  Event?: number;
}

export interface TemplateConfig {
  defaultRecordCounts?: RecordCounts;
  scenarios?: string[];
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  industry: Industry;
  isSystem: boolean;
  userId?: string;
  config: TemplateConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerationConfig {
  templateId: string;
  environmentId?: string;
  name: string;
  description?: string;
  recordCounts: RecordCounts;
  scenario?: string;
  industry?: string;
}
