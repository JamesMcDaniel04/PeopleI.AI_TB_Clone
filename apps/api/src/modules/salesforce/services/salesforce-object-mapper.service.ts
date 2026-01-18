import { Injectable } from '@nestjs/common';

interface DatasetRecord {
  id: string;
  salesforceObject: string;
  localId: string;
  parentLocalId?: string;
  data: Record<string, any>;
}

const RELATIONSHIP_FIELDS: Record<string, Record<string, string>> = {
  Contact: { AccountId: 'Account' },
  Opportunity: { AccountId: 'Account' },
  Task: { WhoId: 'Contact', WhatId: 'Opportunity' },
  Event: { WhoId: 'Contact', WhatId: 'Opportunity' },
  EmailMessage: { RelatedToId: 'Opportunity' },
};

const PARENT_OBJECT_MAP: Record<string, string> = {
  Contact: 'Account',
  Opportunity: 'Account',
  Task: 'Contact',
  Event: 'Contact',
  EmailMessage: 'Opportunity',
};

@Injectable()
export class SalesforceObjectMapperService {
  /**
   * Transform a dataset record for Salesforce injection
   * Replaces local IDs with actual Salesforce IDs
   */
  transformForInjection(
    record: DatasetRecord,
    idMap: Map<string, string>,
  ): Record<string, any> {
    const data = { ...record.data };
    const objectType = record.salesforceObject;

    // Remove internal fields
    delete data._localId;
    delete data._parentLocalId;

    // Map relationship fields
    const relationships = RELATIONSHIP_FIELDS[objectType] || {};

    for (const [fieldName, relatedObjectType] of Object.entries(relationships)) {
      // Check if this relationship should be mapped from parent
      if (record.parentLocalId) {
        const parentType = PARENT_OBJECT_MAP[objectType];
        if (parentType === relatedObjectType) {
          const salesforceId = idMap.get(record.parentLocalId);
          if (salesforceId) {
            data[fieldName] = salesforceId;
          }
        }
      }

      // Also check if the data already has a local ID reference
      const localIdField = `${fieldName}_localId`;
      if (data[localIdField]) {
        const salesforceId = idMap.get(data[localIdField]);
        if (salesforceId) {
          data[fieldName] = salesforceId;
        }
        delete data[localIdField];
      }
    }

    // Handle special case for WhatId on Task/Event (could be Opportunity or Account)
    if ((objectType === 'Task' || objectType === 'Event') && data.WhatId_localId) {
      const salesforceId = idMap.get(data.WhatId_localId);
      if (salesforceId) {
        data.WhatId = salesforceId;
      }
      delete data.WhatId_localId;
    }

    // Generic mapping for any *_localId fields (supports custom objects)
    for (const [key, value] of Object.entries(data)) {
      if (!key.endsWith('_localId')) {
        continue;
      }
      if (typeof value === 'string') {
        const mappedId = idMap.get(value);
        if (mappedId) {
          const targetField = key.replace(/_localId$/, '');
          data[targetField] = mappedId;
        }
      }
      delete data[key];
    }

    // Remove internal metadata fields
    for (const key of Object.keys(data)) {
      if (key.startsWith('_') || data[key] === undefined) {
        delete data[key];
      }
    }

    return data;
  }

  /**
   * Get the injection order for Salesforce objects
   * Parents must be created before children
   */
  getInjectionOrder(): string[] {
    return ['Account', 'Contact', 'Opportunity', 'Task', 'Event', 'EmailMessage'];
  }

  /**
   * Get injection order for a specific set of object types.
   * Known objects keep their dependency order; unknown types are appended.
   */
  getInjectionOrderFor(objectTypes: string[]): string[] {
    const uniqueTypes = Array.from(new Set(objectTypes));
    const baseOrder = this.getInjectionOrder();
    const ordered = baseOrder.filter((type) => uniqueTypes.includes(type));
    const remaining = uniqueTypes.filter((type) => !ordered.includes(type));
    return [...ordered, ...remaining];
  }

  /**
   * Group records by object type
   */
  groupRecordsByObject(records: DatasetRecord[]): Map<string, DatasetRecord[]> {
    const grouped = new Map<string, DatasetRecord[]>();

    for (const record of records) {
      const objectType = record.salesforceObject;
      if (!grouped.has(objectType)) {
        grouped.set(objectType, []);
      }
      grouped.get(objectType)!.push(record);
    }

    return grouped;
  }

  /**
   * Validate that all required parent records exist in the ID map
   */
  validateRelationships(
    records: DatasetRecord[],
    idMap: Map<string, string>,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const record of records) {
      if (record.parentLocalId && !idMap.has(record.parentLocalId)) {
        errors.push(
          `Record ${record.localId} (${record.salesforceObject}) references missing parent ${record.parentLocalId}`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate required fields and relationship mappings before injection.
   */
  validateRecords(
    records: DatasetRecord[],
    idMap: Map<string, string>,
    options?: { requiredFields?: string[] },
  ): {
    valid: DatasetRecord[];
    failed: { record: DatasetRecord; error: string }[];
  } {
    const valid: DatasetRecord[] = [];
    const failed: { record: DatasetRecord; error: string }[] = [];

    for (const record of records) {
      const errors: string[] = [];
      const data = record.data || {};

      const objectType = record.salesforceObject;

      switch (objectType) {
        case 'Account':
          if (!data.Name) {
            errors.push('Missing Account Name');
          }
          break;
        case 'Contact':
          if (!data.LastName) {
            errors.push('Missing Contact LastName');
          }
          if (!record.parentLocalId || !idMap.has(record.parentLocalId)) {
            errors.push('Missing or invalid Account reference');
          }
          break;
        case 'Opportunity':
          if (!data.Name) {
            errors.push('Missing Opportunity Name');
          }
          if (!data.StageName) {
            errors.push('Missing Opportunity StageName');
          }
          if (!data.CloseDate) {
            errors.push('Missing Opportunity CloseDate');
          }
          if (!record.parentLocalId || !idMap.has(record.parentLocalId)) {
            errors.push('Missing or invalid Account reference');
          }
          break;
        case 'Task':
          if (!data.Subject) {
            errors.push('Missing Task Subject');
          }
          if (data.WhoId_localId && !idMap.has(data.WhoId_localId)) {
            errors.push('Missing Contact reference');
          }
          if (data.WhatId_localId && !idMap.has(data.WhatId_localId)) {
            errors.push('Missing Opportunity reference');
          }
          break;
        case 'Event':
          if (!data.Subject) {
            errors.push('Missing Event Subject');
          }
          if (!data.StartDateTime || !data.EndDateTime) {
            errors.push('Missing Event Start/End time');
          }
          if (data.WhoId_localId && !idMap.has(data.WhoId_localId)) {
            errors.push('Missing Contact reference');
          }
          if (data.WhatId_localId && !idMap.has(data.WhatId_localId)) {
            errors.push('Missing Opportunity reference');
          }
          break;
        case 'EmailMessage':
          if (!data.Subject) {
            errors.push('Missing EmailMessage Subject');
          }
          if (!data.TextBody) {
            errors.push('Missing EmailMessage TextBody');
          }
          if (data.RelatedToId_localId && !idMap.has(data.RelatedToId_localId)) {
            errors.push('Missing Opportunity reference');
          }
          break;
        default:
          break;
      }

      if (options?.requiredFields?.length) {
        const requiredMissing = options.requiredFields.filter((fieldName) => {
          const value = data[fieldName];
          if (value !== undefined && value !== null && value !== '') {
            return false;
          }

          const localIdField = `${fieldName}_localId`;
          if (data[localIdField] && idMap.has(data[localIdField])) {
            return false;
          }

          const relationships = RELATIONSHIP_FIELDS[objectType] || {};
          const parentType = PARENT_OBJECT_MAP[objectType];
          const parentField = Object.entries(relationships).find(
            ([_, relatedType]) => relatedType === parentType,
          )?.[0];

          if (
            parentField &&
            fieldName === parentField &&
            record.parentLocalId &&
            idMap.has(record.parentLocalId)
          ) {
            return false;
          }

          return true;
        });

        if (requiredMissing.length > 0) {
          errors.push(`Missing required fields: ${requiredMissing.join(', ')}`);
        }
      }

      if (errors.length > 0) {
        failed.push({ record, error: errors.join('; ') });
      } else {
        valid.push(record);
      }
    }

    return { valid, failed };
  }

  /**
   * Get the cleanup order (reverse of injection order)
   * Children must be deleted before parents
   */
  getCleanupOrder(): string[] {
    return this.getInjectionOrder().reverse();
  }

  /**
   * Get cleanup order for a specific set of object types.
   */
  getCleanupOrderFor(objectTypes: string[]): string[] {
    return this.getInjectionOrderFor(objectTypes).reverse();
  }

  /**
   * Clean Salesforce data for display (remove system fields)
   */
  cleanForDisplay(data: Record<string, any>): Record<string, any> {
    const systemFields = [
      'attributes',
      'Id',
      'IsDeleted',
      'CreatedDate',
      'CreatedById',
      'LastModifiedDate',
      'LastModifiedById',
      'SystemModstamp',
    ];

    const cleaned = { ...data };
    for (const field of systemFields) {
      delete cleaned[field];
    }

    return cleaned;
  }

  getRequiredFieldsFromDescribe(describe: any): string[] {
    const fields = Array.isArray(describe?.fields) ? describe.fields : [];
    return fields
      .filter(
        (field) =>
          field.createable &&
          field.nillable === false &&
          field.defaultedOnCreate === false &&
          field.calculated === false &&
          field.autoNumber === false,
      )
      .map((field) => field.name);
  }

  getDefaultRecordTypeId(describe: any): string | null {
    const recordTypes = Array.isArray(describe?.recordTypeInfos)
      ? describe.recordTypeInfos
      : [];
    const defaultType = recordTypes.find((info) => info.defaultRecordTypeMapping);
    return defaultType?.recordTypeId || null;
  }

  resolveRecordTypeId(describe: any, value: string): string | null {
    if (!value) {
      return null;
    }

    const recordTypes = Array.isArray(describe?.recordTypeInfos)
      ? describe.recordTypeInfos
      : [];
    const byId = recordTypes.find((info) => info.recordTypeId === value);
    if (byId?.recordTypeId) {
      return byId.recordTypeId;
    }

    const normalized = value.toLowerCase();
    const byName = recordTypes.find(
      (info) => info.name?.toLowerCase() === normalized,
    );
    if (byName?.recordTypeId) {
      return byName.recordTypeId;
    }

    const byDeveloperName = recordTypes.find(
      (info) => info.developerName?.toLowerCase() === normalized,
    );
    if (byDeveloperName?.recordTypeId) {
      return byDeveloperName.recordTypeId;
    }

    return null;
  }
}
