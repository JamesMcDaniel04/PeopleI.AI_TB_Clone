import { Injectable, Logger } from '@nestjs/common';
import { SalesforceRestApiService } from './services/salesforce-rest-api.service';
import { SalesforceBulkApiService } from './services/salesforce-bulk-api.service';
import { SalesforceObjectMapperService } from './services/salesforce-object-mapper.service';

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
}

@Injectable()
export class SalesforceService {
  private readonly logger = new Logger(SalesforceService.name);

  constructor(
    private restApiService: SalesforceRestApiService,
    private bulkApiService: SalesforceBulkApiService,
    private objectMapper: SalesforceObjectMapperService,
  ) {}

  async injectRecords(
    environmentId: string,
    records: DatasetRecord[],
    options: InjectionOptions = {},
  ): Promise<InjectionResult> {
    const { useBulkApi = true, bulkThreshold = 200 } = options;

    // Group records by object type
    const recordsByObject = this.objectMapper.groupRecordsByObject(records);

    // Get injection order
    const injectionOrder = this.objectMapper.getInjectionOrder();

    // Track results and ID mappings
    const result: InjectionResult = {
      success: [],
      failed: [],
      summary: { total: records.length, successful: 0, failed: 0 },
    };
    const idMap = new Map<string, string>();

    // Inject in order
    for (const objectType of injectionOrder) {
      const objectRecords = recordsByObject.get(objectType) || [];
      if (objectRecords.length === 0) {
        continue;
      }

      this.logger.log(`Injecting ${objectRecords.length} ${objectType} records`);

      const validation = this.objectMapper.validateRecords(objectRecords, idMap);

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
    }

    this.logger.log(
      `Injection complete: ${result.summary.successful} success, ${result.summary.failed} failed`,
    );

    return result;
  }

  async cleanupRecords(
    environmentId: string,
    salesforceIds: { objectType: string; id: string }[],
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

    // Delete in reverse order (children first)
    const cleanupOrder = this.objectMapper.getCleanupOrder();

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
}
