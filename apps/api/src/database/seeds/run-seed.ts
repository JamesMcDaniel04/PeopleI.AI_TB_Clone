import dataSource from '../../config/typeorm.config';
import { Template, TemplateCategory, Industry } from '../../modules/templates/entities/template.entity';

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
      },
      scenarios: [
        'New business development',
        'Account expansion',
        'Competitive displacement',
      ],
    },
  },
];

async function seedTemplates(): Promise<void> {
  const templateRepo = dataSource.getRepository(Template);
  const existingCount = await templateRepo.count({ where: { isSystem: true } });

  if (existingCount > 0) {
    console.log('System templates already seeded. Skipping.');
    return;
  }

  await templateRepo.save(templateRepo.create(defaultTemplates));
  console.log(`Seeded ${defaultTemplates.length} system templates.`);
}

async function run(): Promise<void> {
  await dataSource.initialize();

  try {
    await seedTemplates();
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
