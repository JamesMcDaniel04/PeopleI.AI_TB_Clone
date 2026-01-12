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
   * Get the cleanup order (reverse of injection order)
   * Children must be deleted before parents
   */
  getCleanupOrder(): string[] {
    return this.getInjectionOrder().reverse();
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
}
