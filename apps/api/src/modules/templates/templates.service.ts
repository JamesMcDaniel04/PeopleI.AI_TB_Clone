import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Template, Industry, TemplateCategory } from './entities/template.entity';
import { TemplatePrompt } from './entities/template-prompt.entity';
import { DEFAULT_TEMPLATE_PROMPTS } from './default-prompts';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(Template)
    private templatesRepository: Repository<Template>,
    @InjectRepository(TemplatePrompt)
    private promptsRepository: Repository<TemplatePrompt>,
  ) {}

  async findAll(userId?: string): Promise<Template[]> {
    const queryBuilder = this.templatesRepository.createQueryBuilder('template');

    // Return system templates and user's custom templates
    if (userId) {
      queryBuilder.where('template.isSystem = :isSystem OR template.userId = :userId', {
        isSystem: true,
        userId,
      });
    } else {
      queryBuilder.where('template.isSystem = :isSystem', { isSystem: true });
    }

    return queryBuilder.orderBy('template.name', 'ASC').getMany();
  }

  async findById(id: string): Promise<Template> {
    const template = await this.templatesRepository.findOne({
      where: { id },
      relations: ['prompts'],
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async findByIndustry(industry: Industry): Promise<Template[]> {
    return this.templatesRepository.find({
      where: { industry, isSystem: true },
    });
  }

  async create(data: Partial<Template>): Promise<Template> {
    const template = this.templatesRepository.create(data);
    const saved = await this.templatesRepository.save(template);

    await this.ensureDefaultPrompts(saved.id);

    return this.findById(saved.id);
  }

  async update(id: string, data: Partial<Template>): Promise<Template> {
    const template = await this.findById(id);
    Object.assign(template, data);
    return this.templatesRepository.save(template);
  }

  async delete(id: string): Promise<void> {
    const result = await this.templatesRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Template not found');
    }
  }

  async seedDefaultTemplates(): Promise<void> {
    const existingCount = await this.templatesRepository.count({ where: { isSystem: true } });
    const shouldSeedTemplates = existingCount === 0;

    const defaultTemplates: Partial<Template>[] = [
      {
        name: 'Technology Sales',
        description: 'Sales scenario for B2B technology/SaaS companies',
        category: TemplateCategory.INDUSTRY_VERTICAL,
        industry: Industry.TECHNOLOGY,
        isSystem: true,
        config: {
          defaultRecordCounts: {
            Account: 5,
            Contact: 15,
            Opportunity: 8,
            Task: 20,
            Event: 10,
            EmailMessage: 10,
          },
          scenarios: [
            'Enterprise software sales',
            'SaaS platform evaluation',
            'Digital transformation project',
          ],
        },
      },
      {
        name: 'Healthcare Sales',
        description: 'Sales scenario for healthcare and life sciences',
        category: TemplateCategory.INDUSTRY_VERTICAL,
        industry: Industry.HEALTHCARE,
        isSystem: true,
        config: {
          defaultRecordCounts: {
            Account: 5,
            Contact: 15,
            Opportunity: 6,
            Task: 15,
            Event: 8,
            EmailMessage: 8,
          },
          scenarios: [
            'Hospital system evaluation',
            'Medical device procurement',
            'Healthcare IT modernization',
          ],
        },
      },
      {
        name: 'Financial Services',
        description: 'Sales scenario for banking and financial services',
        category: TemplateCategory.INDUSTRY_VERTICAL,
        industry: Industry.FINANCE,
        isSystem: true,
        config: {
          defaultRecordCounts: {
            Account: 4,
            Contact: 12,
            Opportunity: 6,
            Task: 15,
            Event: 8,
            EmailMessage: 8,
          },
          scenarios: [
            'Wealth management platform',
            'Banking software upgrade',
            'Compliance solution',
          ],
        },
      },
      {
        name: 'General B2B Sales',
        description: 'Generic B2B sales scenario for any industry',
        category: TemplateCategory.SALES_SCENARIO,
        industry: Industry.GENERAL,
        isSystem: true,
        config: {
          defaultRecordCounts: {
            Account: 5,
            Contact: 15,
            Opportunity: 10,
            Task: 25,
            Event: 10,
            EmailMessage: 10,
          },
          scenarios: [
            'New business development',
            'Account expansion',
            'Competitive displacement',
          ],
        },
      },
    ];

    if (shouldSeedTemplates) {
      for (const templateData of defaultTemplates) {
        await this.templatesRepository.save(this.templatesRepository.create(templateData));
      }
    }

    const systemTemplates = await this.templatesRepository.find({
      where: { isSystem: true },
    });

    for (const template of systemTemplates) {
      await this.ensureDefaultPrompts(template.id);
    }
  }

  async upsertPrompts(
    templateId: string,
    prompts: Partial<TemplatePrompt>[],
  ): Promise<TemplatePrompt[]> {
    const existing = await this.promptsRepository.find({ where: { templateId } });
    const existingMap = new Map(
      existing.map((prompt) => [prompt.salesforceObject, prompt]),
    );

    const toSave = prompts.map((prompt) => {
      const normalized = {
        ...prompt,
        temperature: prompt.temperature ?? 0.7,
      };
      const current = existingMap.get(prompt.salesforceObject!);
      if (current) {
        Object.assign(current, normalized);
        return current;
      }

      return this.promptsRepository.create({
        ...normalized,
        templateId,
      });
    });

    await this.promptsRepository.save(toSave);
    return this.promptsRepository.find({ where: { templateId } });
  }

  private async ensureDefaultPrompts(templateId: string): Promise<void> {
    const existingPrompts = await this.promptsRepository.find({
      where: { templateId },
    });

    const existingTypes = new Set(existingPrompts.map((prompt) => prompt.salesforceObject));
    const missingPrompts = DEFAULT_TEMPLATE_PROMPTS.filter(
      (prompt) => !existingTypes.has(prompt.salesforceObject),
    ).map((prompt) =>
      this.promptsRepository.create({
        ...prompt,
        templateId,
      }),
    );

    if (missingPrompts.length > 0) {
      await this.promptsRepository.save(missingPrompts);
    }
  }
}
