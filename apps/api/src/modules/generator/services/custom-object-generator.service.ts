import { Injectable, Logger } from '@nestjs/common';
import { OpenAIService, GenerationPrompt } from './openai.service';

export interface CustomObjectConfig {
  objectApiName: string;
  label: string;
  pluralLabel: string;
  fields: CustomFieldConfig[];
  relationships?: CustomRelationshipConfig[];
  description?: string;
}

export interface CustomFieldConfig {
  apiName: string;
  label: string;
  type: 'string' | 'number' | 'currency' | 'date' | 'datetime' | 'boolean' | 'picklist' | 'textarea' | 'email' | 'phone' | 'url';
  required?: boolean;
  picklistValues?: string[];
  defaultValue?: any;
  description?: string;
}

export interface CustomRelationshipConfig {
  fieldApiName: string;
  relatedObjectApiName: string;
  relationshipType: 'lookup' | 'master-detail';
  required?: boolean;
}

export interface CustomObjectGenerationResult {
  objectApiName: string;
  records: Record<string, any>[];
}

@Injectable()
export class CustomObjectGeneratorService {
  private readonly logger = new Logger(CustomObjectGeneratorService.name);

  constructor(private openaiService: OpenAIService) {}

  /**
   * Generate records for a custom Salesforce object
   */
  async generateCustomObjectRecords(
    config: CustomObjectConfig,
    count: number,
    existingRecords: Map<string, any[]>,
    context: {
      industry?: string;
      scenario?: string;
    },
  ): Promise<Record<string, any>[]> {
    const prompt = this.buildCustomObjectPrompt(config, count, existingRecords, context);
    const schema = this.buildCustomObjectSchema(config);

    const result = await this.openaiService.generateStructuredData(prompt, {
      schema,
      schemaName: `${config.objectApiName} generation schema`,
      maxRetries: 2,
    });

    const records = Array.isArray(result.records) ? result.records : [];
    return this.transformCustomRecords(records, config);
  }

  /**
   * Build the prompt for custom object generation
   */
  private buildCustomObjectPrompt(
    config: CustomObjectConfig,
    count: number,
    existingRecords: Map<string, any[]>,
    context: { industry?: string; scenario?: string },
  ): GenerationPrompt {
    const fieldDescriptions = config.fields
      .map((field) => {
        let desc = `- ${field.apiName} (${field.label}): ${this.getFieldTypeDescription(field)}`;
        if (field.required) desc += ' [REQUIRED]';
        if (field.picklistValues?.length) {
          desc += ` - Values: ${field.picklistValues.join(', ')}`;
        }
        if (field.description) desc += ` - ${field.description}`;
        return desc;
      })
      .join('\n');

    const relationshipDescriptions = (config.relationships || [])
      .map((rel) => {
        return `- ${rel.fieldApiName}_localId: Reference to ${rel.relatedObjectApiName}'s _localId (${rel.relationshipType})${rel.required ? ' [REQUIRED]' : ''}`;
      })
      .join('\n');

    const relationshipContext = this.buildRelationshipContext(config.relationships || [], existingRecords);

    const systemPrompt = `You are a B2B sales data specialist generating realistic data for a custom Salesforce object.

CRITICAL RULES:
1. All data must be FICTIONAL - do not use real company names, real person names, or real contact information
2. Generate PII-free data suitable for demo environments
3. Use realistic but fake phone numbers (555-XXX-XXXX format)
4. Use realistic but fake email domains (@example.com, @acme-demo.com)
5. Return data as JSON with a "records" array
6. Each record MUST have a unique _localId field

OBJECT: ${config.objectApiName} (${config.label})
${config.description ? `Description: ${config.description}` : ''}

FIELDS:
${fieldDescriptions}

${relationshipDescriptions ? `RELATIONSHIPS:\n${relationshipDescriptions}` : ''}`;

    const userPrompt = `Generate exactly ${count} ${config.pluralLabel} records for a ${context.industry || 'B2B'} sales scenario.

${context.scenario ? `Scenario: ${context.scenario}` : ''}

${relationshipContext}

Return as JSON: { "records": [...] }

Ensure each record has:
1. A unique _localId (e.g., "${config.objectApiName}_1", "${config.objectApiName}_2")
2. All required fields populated
3. Realistic values appropriate for the field types`;

    return {
      systemPrompt,
      userPrompt,
      temperature: 0.7,
    };
  }

  /**
   * Build JSON schema for validation
   */
  private buildCustomObjectSchema(config: CustomObjectConfig): Record<string, any> {
    const properties: Record<string, any> = {
      _localId: { type: 'string' },
    };

    const required: string[] = ['_localId'];

    for (const field of config.fields) {
      properties[field.apiName] = this.getFieldJsonSchema(field);
      if (field.required) {
        required.push(field.apiName);
      }
    }

    for (const rel of config.relationships || []) {
      properties[`${rel.fieldApiName}_localId`] = { type: 'string' };
      if (rel.required) {
        required.push(`${rel.fieldApiName}_localId`);
      }
    }

    return {
      type: 'object',
      required: ['records'],
      properties: {
        records: {
          type: 'array',
          items: {
            type: 'object',
            required,
            properties,
            additionalProperties: true,
          },
          minItems: 1,
        },
      },
      additionalProperties: true,
    };
  }

  /**
   * Transform and validate custom object records
   */
  private transformCustomRecords(
    records: any[],
    config: CustomObjectConfig,
  ): Record<string, any>[] {
    return records.map((record, index) => {
      const transformed: Record<string, any> = {
        _localId: record._localId || `${config.objectApiName}_${Date.now()}_${index}`,
      };

      // Transform each field
      for (const field of config.fields) {
        const value = record[field.apiName];
        transformed[field.apiName] = this.transformFieldValue(value, field);
      }

      // Preserve relationship local IDs
      for (const rel of config.relationships || []) {
        const localIdField = `${rel.fieldApiName}_localId`;
        if (record[localIdField]) {
          transformed[localIdField] = record[localIdField];
        }
      }

      return transformed;
    });
  }

  /**
   * Get field type description for prompt
   */
  private getFieldTypeDescription(field: CustomFieldConfig): string {
    switch (field.type) {
      case 'string':
        return 'Text field';
      case 'number':
        return 'Numeric value';
      case 'currency':
        return 'Currency amount (USD)';
      case 'date':
        return 'Date (YYYY-MM-DD format)';
      case 'datetime':
        return 'DateTime (ISO 8601 format)';
      case 'boolean':
        return 'true or false';
      case 'picklist':
        return 'Select one value';
      case 'textarea':
        return 'Multi-line text';
      case 'email':
        return 'Email address';
      case 'phone':
        return 'Phone number';
      case 'url':
        return 'Website URL';
      default:
        return 'Text field';
    }
  }

  /**
   * Get JSON schema for field type
   */
  private getFieldJsonSchema(field: CustomFieldConfig): Record<string, any> {
    switch (field.type) {
      case 'number':
      case 'currency':
        return { type: 'number' };
      case 'boolean':
        return { type: 'boolean' };
      case 'picklist':
        if (field.picklistValues?.length) {
          return { type: 'string', enum: field.picklistValues };
        }
        return { type: 'string' };
      default:
        return { type: 'string' };
    }
  }

  /**
   * Transform field value based on type
   */
  private transformFieldValue(value: any, field: CustomFieldConfig): any {
    if (value === null || value === undefined) {
      return field.defaultValue ?? null;
    }

    switch (field.type) {
      case 'number':
      case 'currency':
        const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
        return isNaN(num) ? null : num;

      case 'boolean':
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          return ['true', '1', 'yes'].includes(value.toLowerCase());
        }
        return Boolean(value);

      case 'date':
        try {
          const date = new Date(value);
          return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
        } catch {
          return null;
        }

      case 'datetime':
        try {
          const dt = new Date(value);
          return isNaN(dt.getTime()) ? null : dt.toISOString();
        } catch {
          return null;
        }

      case 'email':
        return this.sanitizeEmail(value);

      case 'phone':
        return this.formatPhone(value);

      case 'url':
        return this.sanitizeUrl(value);

      case 'picklist':
        if (field.picklistValues?.length && !field.picklistValues.includes(value)) {
          return field.picklistValues[0];
        }
        return value;

      default:
        return String(value);
    }
  }

  /**
   * Build context for relationships
   */
  private buildRelationshipContext(
    relationships: CustomRelationshipConfig[],
    existingRecords: Map<string, any[]>,
  ): string {
    if (relationships.length === 0) return '';

    const contexts: string[] = [];

    for (const rel of relationships) {
      const relatedRecords = existingRecords.get(rel.relatedObjectApiName);
      if (relatedRecords?.length) {
        contexts.push(`
Link to ${rel.relatedObjectApiName} records using ${rel.fieldApiName}_localId:
${JSON.stringify(
  relatedRecords.slice(0, 20).map((r) => ({
    _localId: r._localId,
    Name: r.Name || r.Subject || r.FirstName + ' ' + r.LastName || r._localId,
  })),
  null,
  2,
)}
`);
      }
    }

    return contexts.join('\n');
  }

  private sanitizeEmail(email: string): string {
    if (!email) return 'demo@example.com';
    const parts = email.split('@');
    if (parts.length !== 2) return 'demo@example.com';
    const domain = parts[1].toLowerCase();
    const safeDomains = ['example.com', 'example.org', 'demo.com', 'test.com'];
    if (safeDomains.some((safe) => domain.endsWith(safe) || domain.includes('-demo.'))) {
      return email.toLowerCase();
    }
    return `${parts[0].toLowerCase()}@example.com`;
  }

  private formatPhone(phone: string): string {
    if (!phone) return '555-100-1000';
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 10) {
      return `555-${digits.slice(-7, -4)}-${digits.slice(-4)}`;
    }
    return '555-100-1000';
  }

  private sanitizeUrl(url: string): string {
    if (!url) return 'https://www.example.com';
    if (!url.includes('-demo.') && !url.includes('example.')) {
      return 'https://www.example.com';
    }
    return url;
  }

  /**
   * Generate schema from Salesforce describe metadata
   */
  static fromSalesforceDescribe(describe: any): CustomObjectConfig {
    const fields: CustomFieldConfig[] = [];
    const relationships: CustomRelationshipConfig[] = [];

    for (const field of describe.fields || []) {
      // Skip system fields
      if (!field.createable || field.autoNumber || field.calculated) continue;

      // Handle relationship fields
      if (field.type === 'reference' && field.referenceTo?.length) {
        relationships.push({
          fieldApiName: field.name,
          relatedObjectApiName: field.referenceTo[0],
          relationshipType: field.cascadeDelete ? 'master-detail' : 'lookup',
          required: !field.nillable && !field.defaultedOnCreate,
        });
        continue;
      }

      // Map Salesforce field types to our types
      const typeMap: Record<string, CustomFieldConfig['type']> = {
        string: 'string',
        textarea: 'textarea',
        int: 'number',
        double: 'number',
        currency: 'currency',
        percent: 'number',
        date: 'date',
        datetime: 'datetime',
        boolean: 'boolean',
        picklist: 'picklist',
        multipicklist: 'picklist',
        email: 'email',
        phone: 'phone',
        url: 'url',
      };

      fields.push({
        apiName: field.name,
        label: field.label,
        type: typeMap[field.type] || 'string',
        required: !field.nillable && !field.defaultedOnCreate,
        picklistValues: field.picklistValues?.map((pv: any) => pv.value),
        description: field.inlineHelpText,
      });
    }

    return {
      objectApiName: describe.name,
      label: describe.label,
      pluralLabel: describe.labelPlural,
      fields,
      relationships,
      description: describe.inlineHelpText,
    };
  }
}
