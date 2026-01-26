import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIService } from './services/openai.service';
import { PromptBuilderService } from './services/prompt-builder.service';
import { DataTransformerService, TemporalRealism } from './services/data-transformer.service';
import { TemporalSchedulerService, TemporalConfig } from './services/temporal-scheduler.service';
import { CustomObjectConfig, CustomObjectGeneratorService } from './services/custom-object-generator.service';
import { MeetingTranscriptGeneratorService, MeetingConfig } from './services/meeting-transcript-generator.service';
import { TemplatesService } from '../templates/templates.service';
import { DatasetsService } from '../datasets/datasets.service';
import { QueueService } from '../jobs/services/queue.service';
import { GenerateDataDto } from './dto/generate-data.dto';
import { Dataset, DatasetStatus } from '../datasets/entities/dataset.entity';
import { SalesforceRestApiService } from '../salesforce/services/salesforce-rest-api.service';

@Injectable()
export class GeneratorService {
  private readonly logger = new Logger(GeneratorService.name);
  private readonly demoMarker = '[TestBox Demo Data]';

  constructor(
    private openaiService: OpenAIService,
    private promptBuilder: PromptBuilderService,
    private dataTransformer: DataTransformerService,
    private temporalScheduler: TemporalSchedulerService,
    private customObjectGenerator: CustomObjectGeneratorService,
    private meetingTranscriptGenerator: MeetingTranscriptGeneratorService,
    private templatesService: TemplatesService,
    private datasetsService: DatasetsService,
    private queueService: QueueService,
    private configService: ConfigService,
    private salesforceRestApi: SalesforceRestApiService,
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
        temporalRealism: dto.temporalRealism,
      },
    });

    // Queue the generation job
    await this.queueService.addGenerationJob({
      datasetId: dataset.id,
      userId,
    });

    return dataset;
  }

  async executeGeneration(
    datasetId: string,
    onProgress?: (progress: number) => Promise<void> | void,
    shouldCancel?: () => Promise<boolean> | boolean,
  ): Promise<void> {
    const dataset = await this.datasetsService.findById(datasetId);
    if (!dataset) {
      throw new NotFoundException('Dataset not found');
    }

    const template = await this.templatesService.findById(dataset.templateId);

    this.logger.log(`Starting generation for dataset ${datasetId}`);

    await this.datasetsService.updateStatus(datasetId, DatasetStatus.GENERATING);

    try {
      // Generation order respects dependencies
      const standardOrder = [
        'Account',
        'Contact',
        'Lead',
        'Campaign',
        'Opportunity',
        'Case',
        'CampaignMember',
        'Task',
        'Event',
        'EmailMessage',
      ];
      const recordMap = new Map<string, any[]>();
      const totalRecords: Record<string, number> = {};
      const batchSize = this.configService.get<number>('openai.batchSize') || 25;
      const recordCounts = dataset.config.recordCounts || {};
      const standardSet = new Set(standardOrder);
      const customObjectTypes = Object.keys(recordCounts).filter(
        (objectType) => !standardSet.has(objectType) && (recordCounts[objectType] || 0) > 0,
      );
      const customObjectConfigs = await this.loadCustomObjectConfigs(
        customObjectTypes,
        dataset.environmentId,
      );
      const customOrder = this.getCustomObjectGenerationOrder(
        customObjectConfigs,
        customObjectTypes,
      );
      const generationOrder = [...standardOrder, ...customOrder];
      const totalToGenerate = generationOrder.reduce(
        (sum, objectType) => sum + (recordCounts[objectType] || 0),
        0,
      );
      const temporalConfig = this.buildTemporalRealismConfig(
        dataset.config?.temporalRealism,
      );
      let processedCount = 0;

      const reportProgress = async () => {
        if (!onProgress || totalToGenerate === 0) {
          return;
        }
        const progress = Math.min(
          99,
          Math.floor((processedCount / totalToGenerate) * 100),
        );
        await onProgress(progress);
      };

      for (const objectType of generationOrder) {
        const count = recordCounts[objectType] || 0;
        if (count === 0) {
          continue;
        }

        this.logger.log(`Generating ${count} ${objectType} records`);

        const generatedRecords: any[] = [];
        let remaining = count;
        const isCustomObject = customObjectConfigs.has(objectType);

        while (remaining > 0) {
          if (shouldCancel && (await shouldCancel())) {
            throw new Error('Job cancelled');
          }

          const batchCount = Math.min(batchSize, remaining);

          if (isCustomObject) {
            const config = customObjectConfigs.get(objectType)!;
            const customRecords = await this.customObjectGenerator.generateCustomObjectRecords(
              config,
              batchCount,
              recordMap,
              dataset.config,
            );
            const markedRecords = customRecords.map((record) =>
              this.applyDemoMarkerToCustomRecord(record),
            );
            generatedRecords.push(...markedRecords);
            totalRecords[objectType] =
              (totalRecords[objectType] || 0) + markedRecords.length;

            for (const record of markedRecords) {
              await this.datasetsService.createRecord({
                datasetId,
                salesforceObject: objectType,
                localId: record._localId,
                parentLocalId: record._parentLocalId,
                data: record,
              });
            }

            processedCount += markedRecords.length;
            await reportProgress();
            this.logger.log(`Generated ${markedRecords.length} ${objectType} records`);
          } else {
            const prompt = this.promptBuilder.buildPrompt(
              template,
              objectType,
              batchCount,
              recordMap,
              dataset.config,
            );

            const gptResponse = await this.openaiService.generateStructuredData(prompt, {
              schema: prompt.outputSchema,
              schemaName: `${objectType} generation schema`,
              maxRetries: 1,
            });

            const responseRecords = Array.isArray(gptResponse.records)
              ? gptResponse.records
              : [];
            const transformedRecords = this.dataTransformer.transformToSalesforceFormat(
              { records: responseRecords },
              objectType,
              recordMap,
            );

            generatedRecords.push(...transformedRecords);
            totalRecords[objectType] =
              (totalRecords[objectType] || 0) + transformedRecords.length;

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

            processedCount += transformedRecords.length;
            await reportProgress();

            this.logger.log(`Generated ${transformedRecords.length} ${objectType} records`);
          }

          remaining -= batchCount;
        }

        let finalRecords = generatedRecords;
        let requiresUpdate = false;

        if (objectType === 'CampaignMember') {
          finalRecords = this.normalizeCampaignMembers(finalRecords, recordMap);
          requiresUpdate = true;
        }

        if (temporalConfig.enabled && this.isActivityObject(objectType)) {
          finalRecords = this.dataTransformer.applyTemporalRealism(
            finalRecords,
            objectType,
            this.getOpportunityTimelineData(recordMap),
            temporalConfig,
          );
          requiresUpdate = true;
        }

        recordMap.set(objectType, finalRecords);

        if (requiresUpdate && finalRecords.length > 0) {
          await this.datasetsService.updateRecordsData(
            datasetId,
            finalRecords.map((record) => ({
              localId: record._localId,
              data: record,
            })),
          );
        }
      }

      // Update dataset status and record counts
      await this.datasetsService.update(datasetId, {
        status: DatasetStatus.GENERATED,
        recordCounts: totalRecords,
        completedAt: new Date(),
      });

      if (onProgress) {
        await onProgress(100);
      }

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

    const result = await this.openaiService.generateStructuredData(prompt, {
      schema: this.promptBuilder.getEmailOutputSchema(),
      schemaName: 'email thread schema',
      maxRetries: 1,
    });

    // Transform and save email records
    const emails = Array.isArray(result.emails) ? result.emails : [];
    const emailRecords = this.dataTransformer.generateRealisticEmailThread(
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

    const result = await this.openaiService.generateStructuredData(prompt, {
      schema: this.promptBuilder.getCallOutputSchema(),
      schemaName: 'call transcript schema',
      maxRetries: 1,
    });

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

  async generateMeetingTranscript(
    datasetId: string,
    opportunityLocalId: string,
    meetingType: MeetingConfig['type'] = 'demo',
    durationMinutes = 45,
  ): Promise<void> {
    const dataset = await this.datasetsService.findById(datasetId);
    const records = await this.datasetsService.getRecords(datasetId);

    const opportunity = records.find(
      (r) => r.salesforceObject === 'Opportunity' && r.localId === opportunityLocalId,
    );

    if (!opportunity) {
      throw new NotFoundException('Opportunity not found');
    }

    const account = records.find(
      (r) =>
        r.salesforceObject === 'Account' &&
        r.localId === opportunity.data._parentLocalId,
    );

    const contacts = records.filter(
      (r) =>
        r.salesforceObject === 'Contact' &&
        (r.parentLocalId === opportunity.data._parentLocalId ||
          r.data?._parentLocalId === opportunity.data._parentLocalId),
    );

    if (contacts.length === 0) {
      throw new NotFoundException('No contact found for this opportunity');
    }

    const accountName = account?.data?.Name || 'Demo Customer';
    const industry = account?.data?.Industry || dataset.config?.industry || 'Technology';
    const primaryContact = contacts[0];
    const participantContacts = contacts.slice(0, 3).map((contact) => ({
      name: `${contact.data?.FirstName || 'Customer'} ${contact.data?.LastName || ''}`.trim(),
      title: contact.data?.Title || 'Stakeholder',
      company: accountName,
      role: 'attendee' as const,
    }));

    const salesRole = meetingType === 'demo' || meetingType === 'technical' ? 'presenter' : 'host';
    const participants: MeetingConfig['participants'] = [
      {
        name: 'Jordan Blake',
        title: 'Account Executive',
        company: 'Our Company',
        role: salesRole,
      },
      ...participantContacts,
    ];

    const agendaByType: Record<MeetingConfig['type'], string[]> = {
      discovery: [
        'Introductions and goals',
        'Current process walkthrough',
        'Pain points and priorities',
        'Success criteria and timeline',
        'Next steps',
      ],
      demo: [
        'Introductions',
        'Recap of requirements',
        'Product demonstration',
        'Q&A',
        'Next steps',
      ],
      negotiation: [
        'Proposal recap',
        'Commercial terms discussion',
        'Risk mitigation',
        'Legal and procurement steps',
        'Decision timeline',
      ],
      kickoff: [
        'Project goals and scope',
        'Stakeholders and roles',
        'Timeline and milestones',
        'Implementation plan',
        'Next steps',
      ],
      qbr: [
        'Performance highlights',
        'Usage and adoption',
        'Open issues',
        'Roadmap alignment',
        'Next quarter priorities',
      ],
      technical: [
        'Architecture overview',
        'Integration requirements',
        'Security and compliance',
        'Implementation plan',
        'Next steps',
      ],
      executive: [
        'Strategic objectives',
        'Business outcomes',
        'Partnership vision',
        'Investment overview',
        'Executive alignment',
      ],
    };

    const meetingConfig: MeetingConfig = {
      type: meetingType,
      durationMinutes,
      participants,
      agenda: agendaByType[meetingType],
      industry,
      opportunityStage: opportunity.data?.StageName,
      productContext: opportunity.data?.Description || dataset.config?.scenario,
    };

    const transcript = await this.meetingTranscriptGenerator.generateMeetingTranscript(
      meetingConfig,
    );

    const temporalConfig = this.buildTemporalRealismConfig(
      dataset.config?.temporalRealism,
    );
    const startDateTime = this.pickMeetingStartDate(
      opportunity.data,
      temporalConfig,
      durationMinutes,
    );

    const eventRecord = this.meetingTranscriptGenerator.toSalesforceEvent(
      transcript,
      meetingConfig,
      startDateTime,
      primaryContact.localId,
      opportunityLocalId,
    );
    const markedEvent = this.applyDemoMarkerToCustomRecord(eventRecord);

    await this.datasetsService.createRecord({
      datasetId,
      salesforceObject: 'Event',
      localId: markedEvent._localId,
      parentLocalId: primaryContact.localId,
      data: markedEvent,
    });
  }

  private buildTemporalRealismConfig(
    config?: {
      enabled?: boolean;
      startDate?: string;
      endDate?: string;
      pattern?: TemporalRealism['pattern'];
    },
  ): TemporalRealism {
    const enabled = config?.enabled ?? true;
    const startDate = this.parseDate(config?.startDate);
    const endDate = this.parseDate(config?.endDate);
    return {
      enabled,
      startDate,
      endDate,
      pattern: config?.pattern,
    };
  }

  private parseDate(value?: string | Date): Date | undefined {
    if (!value) {
      return undefined;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) {
      return undefined;
    }
    return date;
  }

  private isActivityObject(objectType: string): boolean {
    return objectType === 'Task' || objectType === 'Event' || objectType === 'EmailMessage';
  }

  private getOpportunityTimelineData(
    recordMap: Map<string, any[]>,
  ): Array<{ localId: string; stageName: string; closeDate: string }> {
    const opportunities = recordMap.get('Opportunity') || [];
    const fallbackDate = new Date();
    fallbackDate.setDate(fallbackDate.getDate() + 30);
    const fallbackDateString = fallbackDate.toISOString().split('T')[0];

    return opportunities
      .map((opp) => ({
        localId: opp._localId,
        stageName: opp.StageName || opp.stageName || 'Prospecting',
        closeDate: opp.CloseDate || opp.closeDate || fallbackDateString,
      }))
      .filter((opp) => Boolean(opp.localId));
  }

  private normalizeCampaignMembers(
    records: any[],
    recordMap: Map<string, any[]>,
  ): any[] {
    const campaigns = (recordMap.get('Campaign') || []).map((c) => c._localId).filter(Boolean);
    const leads = (recordMap.get('Lead') || []).map((l) => l._localId).filter(Boolean);
    const contacts = (recordMap.get('Contact') || []).map((c) => c._localId).filter(Boolean);

    return records.map((record, index) => {
      const updated = { ...record };

      if (!updated.CampaignId_localId && campaigns.length > 0) {
        updated.CampaignId_localId = campaigns[index % campaigns.length];
      }

      const hasLead = updated.LeadId_localId && leads.includes(updated.LeadId_localId);
      const hasContact =
        updated.ContactId_localId && contacts.includes(updated.ContactId_localId);

      if (hasLead && hasContact) {
        if (Math.random() < 0.5) {
          delete updated.ContactId_localId;
        } else {
          delete updated.LeadId_localId;
        }
      } else if (!hasLead && !hasContact) {
        if (leads.length > 0 && contacts.length > 0) {
          if (Math.random() < 0.5) {
            updated.LeadId_localId = leads[index % leads.length];
          } else {
            updated.ContactId_localId = contacts[index % contacts.length];
          }
        } else if (leads.length > 0) {
          updated.LeadId_localId = leads[index % leads.length];
        } else if (contacts.length > 0) {
          updated.ContactId_localId = contacts[index % contacts.length];
        }
      }

      const status = (updated.Status || '').toString().toLowerCase();
      if (status.includes('respond')) {
        updated.HasResponded = true;
        if (!updated.FirstRespondedDate) {
          updated.FirstRespondedDate = new Date().toISOString().split('T')[0];
        }
      } else if (status.length > 0) {
        updated.HasResponded = false;
        updated.FirstRespondedDate = null;
      }

      return updated;
    });
  }

  private applyDemoMarkerToCustomRecord(record: Record<string, any>): Record<string, any> {
    const updated = { ...record };
    const marker = this.demoMarker;

    if (Object.prototype.hasOwnProperty.call(updated, 'Description')) {
      const text = updated.Description || '';
      if (typeof text === 'string' && !text.includes(marker)) {
        updated.Description = text ? `${text}\n${marker}` : marker;
      } else if (!text) {
        updated.Description = marker;
      }
      return updated;
    }

    if (Object.prototype.hasOwnProperty.call(updated, 'Subject')) {
      const text = updated.Subject || '';
      if (typeof text === 'string' && !text.includes(marker)) {
        updated.Subject = text ? `${text} ${marker}` : marker;
      } else if (!text) {
        updated.Subject = marker;
      }
    }

    return updated;
  }

  private async loadCustomObjectConfigs(
    objectTypes: string[],
    environmentId?: string,
  ): Promise<Map<string, CustomObjectConfig>> {
    const configs = new Map<string, CustomObjectConfig>();
    if (objectTypes.length === 0) {
      return configs;
    }

    if (!environmentId) {
      throw new BadRequestException(
        'Custom object generation requires a connected Salesforce environment.',
      );
    }

    for (const objectType of objectTypes) {
      const describe = await this.salesforceRestApi.describeObject(environmentId, objectType);
      const config = CustomObjectGeneratorService.fromSalesforceDescribe(describe);
      configs.set(objectType, config);
    }

    return configs;
  }

  private getCustomObjectGenerationOrder(
    configs: Map<string, CustomObjectConfig>,
    fallbackOrder: string[],
  ): string[] {
    const nodes = Array.from(configs.keys());
    if (nodes.length === 0) {
      return [];
    }

    const adjacency = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();

    for (const node of nodes) {
      adjacency.set(node, new Set());
      inDegree.set(node, 0);
    }

    for (const config of configs.values()) {
      const current = config.objectApiName;
      for (const rel of config.relationships || []) {
        const related = rel.relatedObjectApiName;
        if (configs.has(related) && related !== current) {
          adjacency.get(related)!.add(current);
          inDegree.set(current, (inDegree.get(current) || 0) + 1);
        }
      }
    }

    const queue = nodes.filter((node) => (inDegree.get(node) || 0) === 0);
    const ordered: string[] = [];

    while (queue.length > 0) {
      const node = queue.shift()!;
      ordered.push(node);
      const neighbors = adjacency.get(node) || new Set();
      for (const neighbor of neighbors) {
        const nextCount = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, nextCount);
        if (nextCount === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (ordered.length !== nodes.length) {
      this.logger.warn('Custom object dependency cycle detected; using fallback order.');
      return fallbackOrder.filter((type) => configs.has(type));
    }

    return ordered;
  }

  private pickMeetingStartDate(
    opportunityData: Record<string, any>,
    temporalConfig: TemporalRealism,
    durationMinutes: number,
  ): Date {
    const now = new Date();
    if (!this.temporalScheduler || !temporalConfig?.enabled) {
      const fallback = new Date();
      fallback.setDate(fallback.getDate() + 1);
      fallback.setHours(10, 0, 0, 0);
      return fallback;
    }

    let startDate = temporalConfig.startDate;
    let endDate = temporalConfig.endDate;

    if (!startDate || !endDate) {
      const closeDate =
        this.parseDate(opportunityData?.CloseDate || opportunityData?.closeDate) || now;
      const stageName =
        opportunityData?.StageName || opportunityData?.stageName || 'Prospecting';
      const cycle = this.temporalScheduler.generateSalesCycleDates(closeDate, stageName);
      startDate = startDate || cycle.startDate;
      endDate = endDate || cycle.endDate;
    }

    const slots = this.temporalScheduler.generateMeetingSlots(1, durationMinutes, {
      startDate,
      endDate,
      densityPattern: temporalConfig.pattern || 'front-loaded',
    });

    return slots[0]?.date || now;
  }
}
