import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesforceRestApiService } from './services/salesforce-rest-api.service';
import { SalesforceBulkApiService } from './services/salesforce-bulk-api.service';
import { SalesforceObjectMapperService } from './services/salesforce-object-mapper.service';
import { Environment } from '../environments/entities/environment.entity';

interface DatasetRecord {
  id: string;
  salesforceObject: string;
  localId: string;
  parentLocalId?: string;
  data: Record<string, any>;
}

interface InjectionResult {
  success: { localId: string; salesforceId: string }[];
  failed: { localId: string; error: string }[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

interface InjectionOptions {
  useBulkApi?: boolean;
  bulkThreshold?: number;
  onProgress?: (processed: number, total: number) => Promise<void> | void;
}

@Injectable()
export class SalesforceService {
  private readonly logger = new Logger(SalesforceService.name);
  private describeCache = new Map<string, { expiresAt: number; data: any }>();

  constructor(
    private restApiService: SalesforceRestApiService,
    private bulkApiService: SalesforceBulkApiService,
    private objectMapper: SalesforceObjectMapperService,
    private configService: ConfigService,
    @InjectRepository(Environment)
    private environmentsRepository: Repository<Environment>,
  ) {}

  async injectRecords(
    environmentId: string,
    records: DatasetRecord[],
    options: InjectionOptions = {},
  ): Promise<InjectionResult> {
    const { useBulkApi = true, bulkThreshold = 200, onProgress } = options;

    const environment = await this.environmentsRepository.findOne({
      where: { id: environmentId },
    });
    const injectionConfig = environment?.injectionConfig || {};
    const recordTypeOverrides = injectionConfig.recordTypeOverrides || {};
    const fieldMappings = injectionConfig.fieldMappings || {};
    const fieldDefaults = injectionConfig.fieldDefaults || {};

    // Group records by object type
    const recordsByObject = this.objectMapper.groupRecordsByObject(records);

    // Get injection order
    const injectionOrder = this.objectMapper.getInjectionOrderFor([...recordsByObject.keys()]);

    // Track results and ID mappings
    const result: InjectionResult = {
      success: [],
      failed: [],
      summary: { total: records.length, successful: 0, failed: 0 },
    };
    const idMap = new Map<string, string>();

    const totalRecords = records.length;
    let processed = 0;

    // Inject in order
    for (const objectType of injectionOrder) {
      const objectRecords = recordsByObject.get(objectType) || [];
      if (objectRecords.length === 0) {
        continue;
      }

      this.logger.log(`Injecting ${objectRecords.length} ${objectType} records`);

      let requiredFields: string[] = [];
      let defaultRecordTypeId: string | null = null;
      let resolvedRecordTypeId: string | null = null;
      const overrideRecordType = recordTypeOverrides[objectType];

      try {
        const describe = await this.getDescribe(environmentId, objectType);
        requiredFields = this.objectMapper.getRequiredFieldsFromDescribe(describe);
        defaultRecordTypeId = this.objectMapper.getDefaultRecordTypeId(describe);
        if (objectType === 'EmailMessage') {
          this.normalizeEmailMessageReferences(objectRecords, describe);
        }
        if (overrideRecordType) {
          resolvedRecordTypeId =
            this.objectMapper.resolveRecordTypeId(describe, overrideRecordType) ||
            overrideRecordType;
        }
      } catch (error: any) {
        this.logger.warn(
          `Describe metadata unavailable for ${objectType}: ${error.message}`,
        );
      }

      if (overrideRecordType && !resolvedRecordTypeId) {
        resolvedRecordTypeId = overrideRecordType;
      }

      const recordTypeToApply = resolvedRecordTypeId || defaultRecordTypeId;
      const shouldForceRecordType = Boolean(resolvedRecordTypeId);
      const objectFieldMappings = fieldMappings[objectType] || {};
      const objectFieldDefaults = fieldDefaults[objectType] || {};

      objectRecords.forEach((record) => {
        let data = record.data || {};
        data = this.applyFieldMappings(data, objectFieldMappings);
        data = this.applyFieldDefaults(data, objectFieldDefaults);
        if (recordTypeToApply) {
          if (shouldForceRecordType || !data.RecordTypeId) {
            data.RecordTypeId = recordTypeToApply;
          }
        }
        record.data = data;
      });

      const validation = this.objectMapper.validateRecords(objectRecords, idMap, {
        requiredFields,
      });

      validation.failed.forEach(({ record, error }) => {
        result.failed.push({
          localId: record.localId,
          error,
        });
        result.summary.failed++;
      });

      const validRecords = validation.valid;
      if (validRecords.length === 0) {
        continue;
      }

      // Transform records (replace local IDs with Salesforce IDs)
      const transformedRecords = validRecords.map((record) => ({
        ...record,
        transformedData: this.objectMapper.transformForInjection(record, idMap),
      }));

      // Choose API based on record count
      const shouldUseBulkApi = useBulkApi && validRecords.length > bulkThreshold;

      try {
        if (shouldUseBulkApi) {
          const bulkResults = await this.bulkApiService.insertRecords(
            environmentId,
            objectType,
            transformedRecords.map((r) => r.transformedData),
          );

          // Process bulk results
          bulkResults.forEach((bulkResult, index) => {
            const record = transformedRecords[index];
            if (bulkResult.success && bulkResult.id) {
              result.success.push({
                localId: record.localId,
                salesforceId: bulkResult.id,
              });
              idMap.set(record.localId, bulkResult.id);
              result.summary.successful++;
            } else {
              result.failed.push({
                localId: record.localId,
                error: bulkResult.errors?.join(', ') || 'Unknown error',
              });
              result.summary.failed++;
            }
          });
        } else {
          const restResults = await this.restApiService.createRecords(
            environmentId,
            objectType,
            transformedRecords.map((r) => r.transformedData),
          );

          // Process REST results
          restResults.forEach((restResult, index) => {
            const record = transformedRecords[index];
            if (restResult.success) {
              result.success.push({
                localId: record.localId,
                salesforceId: restResult.id,
              });
              idMap.set(record.localId, restResult.id);
              result.summary.successful++;
            } else {
              result.failed.push({
                localId: record.localId,
                error: restResult.errors?.map((e) => e.message).join(', ') || 'Unknown error',
              });
              result.summary.failed++;
            }
          });
        }
      } catch (error: any) {
        this.logger.error(`Failed to inject ${objectType} records: ${error.message}`);
        // Mark all records in this batch as failed
        transformedRecords.forEach((record) => {
          result.failed.push({
            localId: record.localId,
            error: error.message,
          });
          result.summary.failed++;
        });
      }

      processed += objectRecords.length;
      if (onProgress) {
        await onProgress(processed, totalRecords);
      }
    }

    this.logger.log(
      `Injection complete: ${result.summary.successful} success, ${result.summary.failed} failed`,
    );

    return result;
  }

  async cleanupRecords(
    environmentId: string,
    salesforceIds: { objectType: string; id: string }[],
    onProgress?: (processed: number, total: number) => Promise<void> | void,
  ): Promise<{ success: number; failed: number; successIds: string[]; failedIds: string[] }> {
    // Group by object type
    const idsByObject = new Map<string, string[]>();
    for (const { objectType, id } of salesforceIds) {
      if (!idsByObject.has(objectType)) {
        idsByObject.set(objectType, []);
      }
      idsByObject.get(objectType)!.push(id);
    }

    let success = 0;
    let failed = 0;
    const successIds: string[] = [];
    const failedIds: string[] = [];

    const totalIds = salesforceIds.length;
    let processed = 0;

    // Delete in reverse order (children first)
    const cleanupOrder = this.objectMapper.getCleanupOrderFor([...idsByObject.keys()]);

    for (const objectType of cleanupOrder) {
      const ids = idsByObject.get(objectType) || [];
      if (ids.length === 0) {
        continue;
      }

      this.logger.log(`Deleting ${ids.length} ${objectType} records`);

      try {
        if (ids.length > 200) {
          // Use bulk API for large deletes
          const results = await this.bulkApiService.deleteRecords(environmentId, objectType, ids);
          results.forEach((result, index) => {
            const recordId = result.id || ids[index];
            if (result.success) {
              success++;
              if (recordId) {
                successIds.push(recordId);
              }
            } else {
              failed++;
              if (recordId) {
                failedIds.push(recordId);
              }
            }
          });
        } else {
          // Use REST API for smaller deletes
          const results = await this.restApiService.deleteRecords(environmentId, objectType, ids);
          results.forEach((result, index) => {
            const recordId = result.id || ids[index];
            if (result.success) {
              success++;
              if (recordId) {
                successIds.push(recordId);
              }
            } else {
              failed++;
              if (recordId) {
                failedIds.push(recordId);
              }
            }
          });
        }
      } catch (error: any) {
        this.logger.error(`Failed to delete ${objectType} records: ${error.message}`);
        failed += ids.length;
        failedIds.push(...ids);
      }

      processed += ids.length;
      if (onProgress) {
        await onProgress(processed, totalIds);
      }
    }

    return { success, failed, successIds, failedIds };
  }

  async verifyRecords(
    environmentId: string,
    objectType: string,
    salesforceIds: string[],
  ): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>();

    if (salesforceIds.length === 0) {
      return result;
    }

    try {
      const idList = salesforceIds.map((id) => `'${id}'`).join(',');
      const records = await this.restApiService.query(
        environmentId,
        `SELECT Id FROM ${objectType} WHERE Id IN (${idList})`,
      );

      const foundIds = new Set(records.map((r) => r.Id));

      for (const id of salesforceIds) {
        result.set(id, foundIds.has(id));
      }
    } catch (error: any) {
      this.logger.error(`Failed to verify ${objectType} records: ${error.message}`);
      // Mark all as not found on error
      for (const id of salesforceIds) {
        result.set(id, false);
      }
    }

    return result;
  }

  private async getDescribe(environmentId: string, objectType: string): Promise<any> {
    const cacheKey = `${environmentId}:${objectType}`;
    const cached = this.describeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const ttlSeconds =
      this.configService.get<number>('salesforce.describeCacheTtlSeconds') || 600;
    const data = await this.restApiService.describeObject(environmentId, objectType);
    this.describeCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return data;
  }

  private normalizeEmailMessageReferences(records: DatasetRecord[], describe: any): void {
    const fields = Array.isArray(describe?.fields) ? describe.fields : [];
    const createableFields = new Set(
      fields.filter((field: any) => field.createable).map((field: any) => field.name),
    );

    const hasParentId = createableFields.has('ParentId');
    const hasRelatedToId = createableFields.has('RelatedToId');

    if (!hasParentId && !hasRelatedToId) {
      return;
    }

    const targetField = hasParentId ? 'ParentId' : 'RelatedToId';
    const sourceField = targetField === 'ParentId' ? 'RelatedToId' : 'ParentId';
    const targetLocal = `${targetField}_localId`;
    const sourceLocal = `${sourceField}_localId`;

    for (const record of records) {
      const data = record.data || {};
      if (!data[targetLocal] && data[sourceLocal]) {
        data[targetLocal] = data[sourceLocal];
      }
      if (data[sourceLocal]) {
        delete data[sourceLocal];
      }
      record.data = data;
    }
  }

  private applyFieldMappings(
    data: Record<string, any>,
    mappings: Record<string, string>,
  ): Record<string, any> {
    if (!mappings || Object.keys(mappings).length === 0) {
      return data;
    }

    const next = { ...data };
    for (const [sourceField, targetField] of Object.entries(mappings)) {
      if (!sourceField || !targetField) {
        continue;
      }

      if (!Object.prototype.hasOwnProperty.call(next, sourceField)) {
        continue;
      }

      const value = next[sourceField];
      const hasTarget = Object.prototype.hasOwnProperty.call(next, targetField);
      const targetValue = next[targetField];
      if (!hasTarget || targetValue === undefined || targetValue === null || targetValue === '') {
        next[targetField] = value;
      }

      if (targetField !== sourceField) {
        delete next[sourceField];
      }
    }

    return next;
  }

  private applyFieldDefaults(
    data: Record<string, any>,
    defaults: Record<string, any>,
  ): Record<string, any> {
    if (!defaults || Object.keys(defaults).length === 0) {
      return data;
    }

    const next = { ...data };
    for (const [field, value] of Object.entries(defaults)) {
      if (next[field] === undefined || next[field] === null || next[field] === '') {
        next[field] = value;
      }
    }

    return next;
  }
}
