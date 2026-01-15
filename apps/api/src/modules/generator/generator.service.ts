import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OpenAIService } from './services/openai.service';
import { PromptBuilderService } from './services/prompt-builder.service';
import { DataTransformerService } from './services/data-transformer.service';
import { TemplatesService } from '../templates/templates.service';
import { DatasetsService } from '../datasets/datasets.service';
import { QueueService } from '../jobs/services/queue.service';
import { GenerateDataDto } from './dto/generate-data.dto';
import { Dataset, DatasetStatus } from '../datasets/entities/dataset.entity';

@Injectable()
export class GeneratorService {
  private readonly logger = new Logger(GeneratorService.name);

  constructor(
    private openaiService: OpenAIService,
    private promptBuilder: PromptBuilderService,
    private dataTransformer: DataTransformerService,
    private templatesService: TemplatesService,
    private datasetsService: DatasetsService,
    private queueService: QueueService,
  ) {}

  async startGeneration(userId: string, dto: GenerateDataDto): Promise<Dataset> {
    // Verify template exists
    const template = await this.templatesService.findById(dto.templateId);
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Create dataset record
    const dataset = await this.datasetsService.create({
      userId,
      templateId: dto.templateId,
      environmentId: dto.environmentId,
      name: dto.name,
      description: dto.description,
      config: {
        recordCounts: dto.recordCounts,
        scenario: dto.scenario,
        industry: dto.industry,
      },
    });

    // Queue the generation job
    await this.queueService.addGenerationJob({
      datasetId: dataset.id,
      userId,
    });

    return dataset;
  }

  async executeGeneration(datasetId: string): Promise<void> {
    const dataset = await this.datasetsService.findById(datasetId);
    if (!dataset) {
      throw new NotFoundException('Dataset not found');
    }

    const template = await this.templatesService.findById(dataset.templateId);

    this.logger.log(`Starting generation for dataset ${datasetId}`);

    await this.datasetsService.updateStatus(datasetId, DatasetStatus.GENERATING);

    try {
      // Generation order respects dependencies
      const generationOrder = ['Account', 'Contact', 'Opportunity', 'Task', 'Event'];
      const recordMap = new Map<string, any[]>();
      const totalRecords: Record<string, number> = {};

      for (const objectType of generationOrder) {
        const count = dataset.config.recordCounts?.[objectType] || 0;
        if (count === 0) {
          continue;
        }

        this.logger.log(`Generating ${count} ${objectType} records`);

        const prompt = this.promptBuilder.buildPrompt(
          template,
          objectType,
          count,
          recordMap,
          dataset.config,
        );

        const gptResponse = await this.openaiService.generateStructuredData(prompt);

        const transformedRecords = this.dataTransformer.transformToSalesforceFormat(
          gptResponse,
          objectType,
          recordMap,
        );

        recordMap.set(objectType, transformedRecords);
        totalRecords[objectType] = transformedRecords.length;

        // Save records to database
        for (const record of transformedRecords) {
          await this.datasetsService.createRecord({
            datasetId,
            salesforceObject: objectType,
            localId: record._localId,
            parentLocalId: record._parentLocalId,
            data: record,
          });
        }

        this.logger.log(`Generated ${transformedRecords.length} ${objectType} records`);
      }

      // Update dataset status and record counts
      await this.datasetsService.update(datasetId, {
        status: DatasetStatus.GENERATED,
        recordCounts: totalRecords,
        completedAt: new Date(),
      });

      this.logger.log(`Generation completed for dataset ${datasetId}`);
    } catch (error: any) {
      this.logger.error(`Generation failed for dataset ${datasetId}: ${error.message}`);
      await this.datasetsService.updateStatus(datasetId, DatasetStatus.FAILED, error.message);
      throw error;
    }
  }

  async generateEmailsForOpportunity(
    datasetId: string,
    opportunityLocalId: string,
    emailCount = 3,
  ): Promise<void> {
    const dataset = await this.datasetsService.findById(datasetId);
    const records = await this.datasetsService.getRecords(datasetId);

    // Find the opportunity and related contact
    const opportunity = records.find(
      (r) => r.salesforceObject === 'Opportunity' && r.localId === opportunityLocalId,
    );

    if (!opportunity) {
      throw new NotFoundException('Opportunity not found');
    }

    // Find a contact for this account
    const contact = records.find(
      (r) =>
        r.salesforceObject === 'Contact' &&
        r.parentLocalId === opportunity.data._parentLocalId,
    );

    if (!contact) {
      throw new NotFoundException('No contact found for this opportunity');
    }

    // Find the account
    const account = records.find(
      (r) =>
        r.salesforceObject === 'Account' &&
        r.localId === opportunity.data._parentLocalId,
    );

    const accountName = account?.data?.Name || 'Acme';
    const accountSlug = accountName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'acme';
    const contactEmail =
      contact.data.Email ||
      `${(contact.data.FirstName || 'demo').toLowerCase()}.${(contact.data.LastName || 'user')
        .toLowerCase()}@${accountSlug}-demo.com`;
    const salesRepEmail = `sales@${accountSlug}-demo.com`;

    const prompt = this.promptBuilder.buildEmailPrompt(
      {
        account: account?.data || { Name: 'Unknown Company', Industry: 'Technology' },
        contact: contact.data,
        opportunity: opportunity.data,
      },
      emailCount,
    );

    const result = await this.openaiService.generateStructuredData(prompt);

    // Transform and save email records
    const emails = Array.isArray(result.emails) ? result.emails : [];
    const emailRecords = this.dataTransformer.generateEmailRecords(
      emails,
      contactEmail,
      salesRepEmail,
      opportunityLocalId,
    );

    if (emailRecords.length === 0) {
      this.logger.warn(`No email records generated for opportunity ${opportunityLocalId}`);
      return;
    }

    for (const emailRecord of emailRecords) {
      await this.datasetsService.createRecord({
        datasetId,
        salesforceObject: 'EmailMessage',
        localId: emailRecord._localId,
        data: emailRecord,
      });
    }
  }

  async generateCallTranscript(
    datasetId: string,
    opportunityLocalId: string,
    callType = 'Discovery Call',
    durationMinutes = 30,
  ): Promise<void> {
    const dataset = await this.datasetsService.findById(datasetId);
    const records = await this.datasetsService.getRecords(datasetId);

    const opportunity = records.find(
      (r) => r.salesforceObject === 'Opportunity' && r.localId === opportunityLocalId,
    );

    if (!opportunity) {
      throw new NotFoundException('Opportunity not found');
    }

    const contact = records.find(
      (r) =>
        r.salesforceObject === 'Contact' &&
        r.parentLocalId === opportunity.data._parentLocalId,
    );

    if (!contact) {
      throw new NotFoundException('No contact found for this opportunity');
    }

    const account = records.find(
      (r) =>
        r.salesforceObject === 'Account' &&
        r.localId === opportunity.data._parentLocalId,
    );

    const prompt = this.promptBuilder.buildCallTranscriptPrompt(
      {
        account: account?.data || { Name: 'Unknown Company', Industry: 'Technology' },
        contact: contact.data,
        opportunity: opportunity.data,
        callType,
      },
      durationMinutes,
    );

    const result = await this.openaiService.generateStructuredData(prompt);

    const callRecord = this.dataTransformer.generateCallRecord(
      result,
      contact.localId,
      opportunityLocalId,
      `${callType} - ${contact.data.FirstName} ${contact.data.LastName}`,
    );

    await this.datasetsService.createRecord({
      datasetId,
      salesforceObject: 'Task',
      localId: callRecord._localId,
      data: callRecord,
    });
  }
}
