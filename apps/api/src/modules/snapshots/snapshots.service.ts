import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Snapshot, SnapshotStatus, SnapshotType } from './entities/snapshot.entity';
import { SalesforceRestApiService } from '../salesforce/services/salesforce-rest-api.service';
import { SalesforceBulkApiService } from '../salesforce/services/salesforce-bulk-api.service';
import { SalesforceObjectMapperService } from '../salesforce/services/salesforce-object-mapper.service';
import { EnvironmentsService } from '../environments/environments.service';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';
import { RestoreSnapshotDto } from './dto/restore-snapshot.dto';
import { PaginationDto, PaginatedResult, paginate } from '../../common/dto/pagination.dto';

export type RestoreSnapshotOptions = RestoreSnapshotDto;

@Injectable()
export class SnapshotsService {
  private readonly logger = new Logger(SnapshotsService.name);
  private readonly demoMarker = '[TestBox Demo Data]';

  constructor(
    @InjectRepository(Snapshot)
    private snapshotRepository: Repository<Snapshot>,
    private salesforceRestApi: SalesforceRestApiService,
    private salesforceBulkApi: SalesforceBulkApiService,
    private objectMapper: SalesforceObjectMapperService,
    private environmentsService: EnvironmentsService,
  ) {}

  /**
   * Create a snapshot of the current environment state
   */
  async createSnapshot(userId: string, dto: CreateSnapshotDto): Promise<Snapshot> {
    const environment = await this.environmentsService.findById(dto.environmentId, userId);

    // Create the snapshot record
    const snapshot = this.snapshotRepository.create({
      name: dto.name,
      description: dto.description,
      userId,
      environmentId: dto.environmentId,
      type: dto.type || SnapshotType.MANUAL,
      isGoldenImage: dto.isGoldenImage || false,
      status: SnapshotStatus.CREATING,
      metadata: {
        tags: dto.tags,
        salesforceOrgId: environment.salesforceOrgId,
        createdBy: userId,
      },
    });

    const savedSnapshot = await this.snapshotRepository.save(snapshot);

    // Start the snapshot process asynchronously
    this.captureSnapshotData(savedSnapshot.id, userId, dto.recordIds).catch((error) => {
      this.logger.error(`Failed to capture snapshot ${savedSnapshot.id}:`, error);
    });

    return savedSnapshot;
  }

  /**
   * Capture all data for a snapshot
   */
  private async captureSnapshotData(
    snapshotId: string,
    userId: string,
    specifiedRecordIds?: Record<string, string[]>,
  ): Promise<void> {
    const snapshot = await this.snapshotRepository.findOne({
      where: { id: snapshotId },
      relations: ['environment'],
    });

    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }

    try {
      const environmentId = snapshot.environmentId;

      const recordIds: Record<string, string[]> = {};
      const recordData: Record<string, Record<string, any>[]> = {};
      const objectCounts: Record<string, number> = {};
      let totalRecords = 0;
      let totalSize = 0;

      // Define objects to snapshot
      const objectTypes = specifiedRecordIds
        ? Object.keys(specifiedRecordIds)
        : this.objectMapper.getInjectionOrder();

      for (const objectType of objectTypes) {
        try {
          let ids: string[];

          if (specifiedRecordIds?.[objectType]) {
            // Use specified record IDs
            ids = specifiedRecordIds[objectType];
          } else {
            // Query for all records created by our system (with demo marker)
            ids = await this.findDemoRecordIds(environmentId, objectType);
          }

          if (ids.length === 0) continue;

          // Fetch full record data
          const records = await this.fetchRecordData(environmentId, objectType, ids);

          recordIds[objectType] = ids;
          recordData[objectType] = records;
          objectCounts[objectType] = records.length;
          totalRecords += records.length;
          totalSize += JSON.stringify(records).length;

          this.logger.log(`Captured ${records.length} ${objectType} records for snapshot ${snapshotId}`);
        } catch (error) {
          this.logger.warn(`Failed to capture ${objectType} for snapshot: ${error.message}`);
          // Continue with other objects
        }
      }

      // Update snapshot with captured data
      await this.snapshotRepository.update(snapshotId, {
        recordIds,
        recordData,
        metadata: {
          ...snapshot.metadata,
          totalRecords,
          objectCounts,
        },
        sizeBytes: totalSize,
        status: SnapshotStatus.READY,
      });

      this.logger.log(`Snapshot ${snapshotId} completed: ${totalRecords} records captured`);
    } catch (error) {
      await this.snapshotRepository.update(snapshotId, {
        status: SnapshotStatus.FAILED,
        errorMessage: error.message,
      });
      throw error;
    }
  }

  /**
   * Fetch full record data for a list of IDs
   */
  private async findDemoRecordIds(
    environmentId: string,
    objectType: string,
  ): Promise<string[]> {
    const describe = await this.salesforceRestApi.describeObject(environmentId, objectType);
    const fields = Array.isArray(describe?.fields) ? describe.fields : [];
    const clauses: string[] = [];

    const descriptionField = fields.find(
      (field: any) => field.name === 'Description' && field.filterable,
    );
    const subjectField = fields.find(
      (field: any) => field.name === 'Subject' && field.filterable,
    );

    if (descriptionField) {
      clauses.push(`Description LIKE '%${this.demoMarker}%'`);
    }
    if (subjectField) {
      clauses.push(`Subject LIKE '%${this.demoMarker}%'`);
    }

    if (clauses.length === 0) {
      this.logger.warn(
        `Snapshot skip: ${objectType} has no Description/Subject field for demo marker filtering`,
      );
      return [];
    }

    const query = `SELECT Id FROM ${objectType} WHERE ${clauses.join(' OR ')} LIMIT 10000`;
    const records = await this.salesforceRestApi.query(environmentId, query);
    return records.map((record: any) => record.Id);
  }

  private async fetchRecordData(
    environmentId: string,
    objectType: string,
    ids: string[],
  ): Promise<Record<string, any>[]> {
    if (ids.length === 0) return [];

    // Batch IDs to avoid query limits
    const batchSize = 200;
    const allRecords: Record<string, any>[] = [];

    for (let i = 0; i < ids.length; i += batchSize) {
      const batchIds = ids.slice(i, i + batchSize);
      const idList = batchIds.map((id) => `'${id}'`).join(',');

      // Get field list from describe
      const describe = await this.salesforceRestApi.describeObject(environmentId, objectType);
      const fields = describe.fields
        .filter((f: any) => f.createable || f.name === 'Id')
        .map((f: any) => f.name)
        .join(',');

      const query = `SELECT ${fields} FROM ${objectType} WHERE Id IN (${idList})`;
      const records = await this.salesforceRestApi.query(environmentId, query);

      allRecords.push(...records);
    }

    return allRecords;
  }

  /**
   * Restore a snapshot to the environment
   */
  async restoreSnapshot(
    snapshotId: string,
    userId: string,
    options: RestoreSnapshotOptions = {},
  ): Promise<{ success: boolean; recordsRestored: number; errors: string[] }> {
    const snapshot = await this.snapshotRepository.findOne({
      where: { id: snapshotId, userId },
      relations: ['environment'],
    });

    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }

    if (snapshot.status !== SnapshotStatus.READY) {
      throw new BadRequestException('Snapshot is not ready for restoration');
    }

    if (options.dryRun) {
      return {
        success: true,
        recordsRestored: snapshot.metadata.totalRecords || 0,
        errors: [],
      };
    }

    // Update status
    await this.snapshotRepository.update(snapshotId, {
      status: SnapshotStatus.RESTORING,
    });

    try {
      const environmentId = snapshot.environmentId;

      const errors: string[] = [];
      let recordsRestored = 0;

      // Optionally delete existing data first
      if (options.deleteExisting) {
        await this.deleteExistingData(environmentId, snapshot, options.objectTypes);
      }

      // Restore in dependency order
      const objectTypes = options.objectTypes || this.objectMapper.getInjectionOrder();
      const orderedTypes = this.objectMapper.getInjectionOrderFor(objectTypes);

      // Map old IDs to new IDs for relationship restoration
      const idMap = new Map<string, string>();

      for (const objectType of orderedTypes) {
        const records = snapshot.recordData[objectType];
        if (!records || records.length === 0) continue;

        try {
          // Prepare records for insertion (remove read-only fields, map relationships)
          const preparedRecords = records.map((record) => {
            const prepared = this.prepareRecordForRestore(record, objectType, idMap);
            return prepared;
          });

          // Use bulk API for large datasets
          if (preparedRecords.length > 50) {
            const result = await this.salesforceBulkApi.insertRecords(
              environmentId,
              objectType,
              preparedRecords,
            );

            // Map old IDs to new IDs
            result.results.forEach((r: any, index: number) => {
              if (r.success && records[index]?.Id) {
                idMap.set(records[index].Id, r.id);
                recordsRestored++;
              } else if (!r.success) {
                errors.push(`${objectType} restore failed: ${r.errors?.join(', ')}`);
              }
            });
          } else {
            // Use REST API for smaller datasets
            for (let i = 0; i < preparedRecords.length; i++) {
              try {
                const result = await this.salesforceRestApi.createRecord(
                  environmentId,
                  objectType,
                  preparedRecords[i],
                );
                if (records[i]?.Id) {
                  idMap.set(records[i].Id, result.id);
                }
                recordsRestored++;
              } catch (error) {
                errors.push(`${objectType} ${records[i]?.Id}: ${error.message}`);
              }
            }
          }

          this.logger.log(`Restored ${preparedRecords.length} ${objectType} records`);
        } catch (error) {
          errors.push(`Failed to restore ${objectType}: ${error.message}`);
          this.logger.error(`Failed to restore ${objectType}:`, error);
        }
      }

      // Update snapshot status
      await this.snapshotRepository.update(snapshotId, {
        status: SnapshotStatus.READY,
        restoredAt: new Date(),
        restoreCount: snapshot.restoreCount + 1,
      });

      return {
        success: errors.length === 0,
        recordsRestored,
        errors,
      };
    } catch (error) {
      await this.snapshotRepository.update(snapshotId, {
        status: SnapshotStatus.READY,
        errorMessage: `Restore failed: ${error.message}`,
      });
      throw error;
    }
  }

  /**
   * Prepare a record for restoration (remove system fields, map relationships)
   */
  private prepareRecordForRestore(
    record: Record<string, any>,
    objectType: string,
    idMap: Map<string, string>,
  ): Record<string, any> {
    const systemFields = [
      'Id',
      'IsDeleted',
      'CreatedDate',
      'CreatedById',
      'LastModifiedDate',
      'LastModifiedById',
      'SystemModstamp',
      'LastActivityDate',
      'LastViewedDate',
      'LastReferencedDate',
      'attributes',
    ];

    const prepared: Record<string, any> = {};

    for (const [key, value] of Object.entries(record)) {
      // Skip system fields
      if (systemFields.includes(key)) continue;

      // Map relationship fields to new IDs
      if (key.endsWith('Id') && typeof value === 'string' && idMap.has(value)) {
        prepared[key] = idMap.get(value);
      } else if (value !== null && value !== undefined) {
        prepared[key] = value;
      }
    }

    return prepared;
  }

  /**
   * Delete existing demo data before restore
   */
  private async deleteExistingData(
    environmentId: string,
    snapshot: Snapshot,
    objectTypes?: string[],
  ): Promise<void> {
    const types = objectTypes || Object.keys(snapshot.recordIds);
    const cleanupOrder = this.objectMapper.getCleanupOrderFor(types);

    for (const objectType of cleanupOrder) {
      const ids = snapshot.recordIds[objectType];
      if (!ids || ids.length === 0) continue;

      try {
        if (ids.length > 50) {
          await this.salesforceBulkApi.deleteRecords(environmentId, objectType, ids);
        } else {
          for (const id of ids) {
            try {
              await this.salesforceRestApi.deleteRecord(environmentId, objectType, id);
            } catch (error) {
              // Record may already be deleted
              this.logger.warn(`Could not delete ${objectType} ${id}: ${error.message}`);
            }
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to delete ${objectType} records: ${error.message}`);
      }
    }
  }

  /**
   * List all snapshots for a user
   */
  async findAll(
    userId: string,
    options?: {
      environmentId?: string;
      type?: SnapshotType;
      isGoldenImage?: boolean;
    },
  ): Promise<Snapshot[]> {
    const query = this.snapshotRepository
      .createQueryBuilder('snapshot')
      .where('snapshot.userId = :userId', { userId })
      .leftJoinAndSelect('snapshot.environment', 'environment')
      .orderBy('snapshot.createdAt', 'DESC');

    if (options?.environmentId) {
      query.andWhere('snapshot.environmentId = :environmentId', {
        environmentId: options.environmentId,
      });
    }

    if (options?.type) {
      query.andWhere('snapshot.type = :type', { type: options.type });
    }

    if (options?.isGoldenImage !== undefined) {
      query.andWhere('snapshot.isGoldenImage = :isGoldenImage', {
        isGoldenImage: options.isGoldenImage,
      });
    }

    return query.getMany();
  }

  async findAllPaginated(
    userId: string,
    pagination: PaginationDto,
    options?: {
      environmentId?: string;
      type?: SnapshotType;
      isGoldenImage?: boolean;
    },
  ): Promise<PaginatedResult<Snapshot>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const query = this.snapshotRepository
      .createQueryBuilder('snapshot')
      .where('snapshot.userId = :userId', { userId })
      .leftJoinAndSelect('snapshot.environment', 'environment')
      .orderBy('snapshot.createdAt', 'DESC');

    if (options?.environmentId) {
      query.andWhere('snapshot.environmentId = :environmentId', {
        environmentId: options.environmentId,
      });
    }

    if (options?.type) {
      query.andWhere('snapshot.type = :type', { type: options.type });
    }

    if (options?.isGoldenImage !== undefined) {
      query.andWhere('snapshot.isGoldenImage = :isGoldenImage', {
        isGoldenImage: options.isGoldenImage,
      });
    }

    const [data, total] = await query.skip(skip).take(limit).getManyAndCount();

    return paginate(data, total, page, limit);
  }

  /**
   * Get a single snapshot
   */
  async findOne(id: string, userId: string): Promise<Snapshot> {
    const snapshot = await this.snapshotRepository.findOne({
      where: { id, userId },
      relations: ['environment'],
    });

    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }

    return snapshot;
  }

  /**
   * Delete a snapshot
   */
  async remove(id: string, userId: string): Promise<void> {
    const snapshot = await this.findOne(id, userId);
    await this.snapshotRepository.remove(snapshot);
  }

  /**
   * Set a snapshot as the golden image for an environment
   */
  async setAsGoldenImage(id: string, userId: string): Promise<Snapshot> {
    const snapshot = await this.findOne(id, userId);

    // Remove golden image status from other snapshots in this environment
    await this.snapshotRepository.update(
      { environmentId: snapshot.environmentId, isGoldenImage: true },
      { isGoldenImage: false },
    );

    // Set this snapshot as golden image
    snapshot.isGoldenImage = true;
    snapshot.type = SnapshotType.GOLDEN_IMAGE;

    return this.snapshotRepository.save(snapshot);
  }

  /**
   * Get the golden image for an environment
   */
  async getGoldenImage(environmentId: string, userId: string): Promise<Snapshot | null> {
    return this.snapshotRepository.findOne({
      where: { environmentId, userId, isGoldenImage: true },
      relations: ['environment'],
    });
  }

  /**
   * Reset environment to golden image
   */
  async resetToGoldenImage(
    environmentId: string,
    userId: string,
  ): Promise<{ success: boolean; recordsRestored: number; errors: string[] }> {
    const goldenImage = await this.getGoldenImage(environmentId, userId);

    if (!goldenImage) {
      throw new NotFoundException('No golden image found for this environment');
    }

    return this.restoreSnapshot(goldenImage.id, userId, { deleteExisting: true });
  }

  /**
   * Create a pre-injection snapshot automatically
   */
  async createPreInjectionSnapshot(
    environmentId: string,
    userId: string,
    datasetName: string,
  ): Promise<Snapshot> {
    return this.createSnapshot(userId, {
      name: `Pre-injection: ${datasetName}`,
      description: `Automatic snapshot before injecting dataset: ${datasetName}`,
      environmentId,
      type: SnapshotType.PRE_INJECTION,
    });
  }
}
