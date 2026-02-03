import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Dataset, DatasetStatus } from './entities/dataset.entity';
import { DatasetRecord, RecordStatus } from './entities/dataset-record.entity';
import { PaginationDto, PaginatedResult, paginate } from '../../common/dto/pagination.dto';

interface CreateDatasetData {
  userId: string;
  templateId?: string;
  environmentId?: string;
  name: string;
  description?: string;
  config?: Record<string, any>;
}

interface CreateRecordData {
  datasetId: string;
  salesforceObject: string;
  localId: string;
  parentLocalId?: string;
  data: Record<string, any>;
}

@Injectable()
export class DatasetsService {
  constructor(
    @InjectRepository(Dataset)
    private datasetsRepository: Repository<Dataset>,
    @InjectRepository(DatasetRecord)
    private recordsRepository: Repository<DatasetRecord>,
  ) {}

  async findAll(userId: string): Promise<Dataset[]> {
    return this.datasetsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      relations: ['template', 'environment'],
    });
  }

  async findAllPaginated(userId: string, pagination: PaginationDto): Promise<PaginatedResult<Dataset>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await this.datasetsRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      relations: ['template', 'environment'],
      skip,
      take: limit,
    });

    return paginate(data, total, page, limit);
  }

  async findById(id: string): Promise<Dataset> {
    const dataset = await this.datasetsRepository.findOne({
      where: { id },
      relations: ['template', 'environment'],
    });

    if (!dataset) {
      throw new NotFoundException('Dataset not found');
    }

    return dataset;
  }

  async create(data: CreateDatasetData): Promise<Dataset> {
    const dataset = this.datasetsRepository.create({
      ...data,
      status: DatasetStatus.PENDING,
    });

    return this.datasetsRepository.save(dataset);
  }

  async update(id: string, data: Partial<Dataset>): Promise<Dataset> {
    await this.datasetsRepository.update(id, data);
    return this.findById(id);
  }

  async updateStatus(id: string, status: DatasetStatus, errorMessage?: string): Promise<void> {
    const updateData: Partial<Dataset> = { status };

    if (status === DatasetStatus.GENERATING) {
      updateData.startedAt = new Date();
    }

    if (status === DatasetStatus.COMPLETED || status === DatasetStatus.FAILED) {
      updateData.completedAt = new Date();
    }

    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    await this.datasetsRepository.update(id, updateData);
  }

  async delete(id: string, userId: string): Promise<void> {
    const dataset = await this.findById(id);

    if (dataset.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    await this.datasetsRepository.remove(dataset);
  }

  async createRecord(data: CreateRecordData): Promise<DatasetRecord> {
    const record = this.recordsRepository.create({
      ...data,
      status: RecordStatus.GENERATED,
    });

    return this.recordsRepository.save(record);
  }

  async getRecords(datasetId: string): Promise<DatasetRecord[]> {
    return this.recordsRepository.find({
      where: { datasetId },
      order: { createdAt: 'ASC' },
    });
  }

  async getRecordsByObject(datasetId: string, objectType: string): Promise<DatasetRecord[]> {
    return this.recordsRepository.find({
      where: { datasetId, salesforceObject: objectType },
      order: { createdAt: 'ASC' },
    });
  }

  async getRecordsPaginated(
    datasetId: string,
    objectType: string | undefined,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<DatasetRecord>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where: any = { datasetId };
    if (objectType) {
      where.salesforceObject = objectType;
    }

    const [data, total] = await this.recordsRepository.findAndCount({
      where,
      order: { createdAt: 'ASC' },
      skip,
      take: limit,
    });

    return paginate(data, total, page, limit);
  }

  async getRecordCounts(datasetId: string): Promise<Record<string, number>> {
    const results = await this.recordsRepository
      .createQueryBuilder('record')
      .select('record.salesforce_object', 'objectType')
      .addSelect('COUNT(*)', 'count')
      .where('record.dataset_id = :datasetId', { datasetId })
      .groupBy('record.salesforce_object')
      .getRawMany();

    const counts: Record<string, number> = {};
    for (const result of results) {
      counts[result.objectType] = parseInt(result.count, 10);
    }

    return counts;
  }

  async updateRecordStatus(
    localId: string,
    status: RecordStatus,
    salesforceId?: string,
    errorMessage?: string,
  ): Promise<void> {
    const updateData: Partial<DatasetRecord> = { status };

    if (salesforceId) {
      updateData.salesforceId = salesforceId;
      updateData.injectedAt = new Date();
    }

    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    await this.recordsRepository.update({ localId }, updateData);
  }

  async updateRecordSalesforceId(
    datasetId: string,
    localId: string,
    salesforceId: string,
  ): Promise<void> {
    await this.recordsRepository.update(
      { datasetId, localId },
      { salesforceId, status: RecordStatus.INJECTED, injectedAt: new Date() },
    );
  }

  async updateRecordsData(
    datasetId: string,
    updates: Array<{ localId: string; data: Record<string, any> }>,
  ): Promise<void> {
    for (const update of updates) {
      await this.recordsRepository.update(
        { datasetId, localId: update.localId },
        { data: update.data },
      );
    }
  }

  async getInjectedRecords(datasetId: string): Promise<{ objectType: string; id: string }[]> {
    const records = await this.recordsRepository.find({
      where: { datasetId, status: RecordStatus.INJECTED },
      select: ['salesforceObject', 'salesforceId'],
    });

    return records
      .filter((r) => r.salesforceId)
      .map((r) => ({
        objectType: r.salesforceObject,
        id: r.salesforceId!,
      }));
  }

  async resetInjectedRecords(datasetId: string, salesforceIds: string[]): Promise<void> {
    const ids = salesforceIds;
    if (ids.length === 0) {
      return;
    }

    await this.recordsRepository.update(
      { datasetId, salesforceId: In(ids) },
      { salesforceId: null, status: RecordStatus.GENERATED, injectedAt: null },
    );
  }
}
