import { Injectable } from '@nestjs/common';
import { Template, Industry } from '../../templates/entities/template.entity';
import { GenerationPrompt } from './openai.service';
import { SalesforceObject } from '../../templates/entities/template-prompt.entity';
import { getDefaultTemplatePrompt } from '../../templates/default-prompts';

interface GenerationConfig {
  recordCounts?: Record<string, number>;
  scenario?: string;
  industry?: string;
}

@Injectable()
export class PromptBuilderService {
  buildPrompt(
    template: Template,
    objectType: string,
    count: number,
    existingRecords: Map<string, any[]>,
    config: GenerationConfig,
  ): GenerationPrompt {
    const industry = config.industry || template.industry || Industry.GENERAL;
    const scenario = config.scenario || 'Standard sales scenario';

    const promptDefinition =
      template.prompts?.find((prompt) => prompt.salesforceObject === objectType) ||
      getDefaultTemplatePrompt(objectType as SalesforceObject);

    const systemPrompt = this.interpolatePrompt(
      promptDefinition?.systemPrompt || this.getSystemPrompt(objectType, industry),
      {
        industry,
        objectType,
        count,
        scenario,
        context: '',
      },
    );

    const context = this.buildContext(objectType, existingRecords);
    const userPrompt = this.interpolatePrompt(
      promptDefinition?.userPromptTemplate ||
        this.getUserPrompt(objectType, count, existingRecords, industry, scenario),
      {
        industry,
        objectType,
        count,
        scenario,
        context,
      },
    );

    const rawTemperature = promptDefinition?.temperature;
    const parsedTemperature =
      typeof rawTemperature === 'string' ? parseFloat(rawTemperature) : rawTemperature;

    return {
      systemPrompt,
      userPrompt,
      temperature: Number.isFinite(parsedTemperature as number) ? (parsedTemperature as number) : 0.7,
      outputSchema: promptDefinition?.outputSchema || this.getDefaultOutputSchema(objectType),
    };
  }

  getDefaultOutputSchema(objectType: string): Record<string, any> {
    const recordSchema = this.getRecordSchema(objectType);

    return {
      type: 'object',
      required: ['records'],
      properties: {
        records: {
          type: 'array',
          items: recordSchema,
          minItems: 1,
        },
      },
      additionalProperties: true,
    };
  }

  getEmailOutputSchema(): Record<string, any> {
    return {
      type: 'object',
      required: ['emails'],
      properties: {
        emails: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['subject', 'body', 'direction'],
            properties: {
              subject: { type: 'string' },
              body: { type: 'string' },
              direction: { type: 'string' },
              timestamp: { type: 'string' },
            },
            additionalProperties: true,
          },
        },
      },
      additionalProperties: true,
    };
  }

  getCallOutputSchema(): Record<string, any> {
    return {
      type: 'object',
      required: ['transcript', 'summary', 'nextSteps'],
      properties: {
        transcript: { type: 'string' },
        summary: { type: 'string' },
        nextSteps: {
          type: 'array',
          items: { type: 'string' },
        },
        duration: { type: 'number' },
      },
      additionalProperties: true,
    };
  }

  private getSystemPrompt(objectType: string, industry: string): string {
    const basePrompt = `You are a B2B sales data specialist generating realistic ${industry} sales data for Salesforce CRM demos.

CRITICAL RULES:
1. All data must be FICTIONAL - do not use real company names, real person names, or real contact information
2. Generate PII-free data suitable for demo environments
3. Use realistic but fake phone numbers (555-XXX-XXXX format)
4. Use realistic but fake email domains (@example.com, @acme-demo.com, @techcorp-demo.com)
5. Maintain consistency in industry terminology and typical sales patterns
6. Return data as JSON with a "records" array

`;

    const objectSpecificPrompts: Record<string, string> = {
      Account: `Generate Account (company) records with these fields:
- Name: Realistic fictional company name (NOT real companies like Google, Microsoft, etc.)
- Industry: ${industry} or related sub-industry
- Website: Fake but realistic domain (use -demo.com suffix)
- Phone: Format 555-XXX-XXXX
- BillingStreet, BillingCity, BillingState, BillingPostalCode, BillingCountry
- NumberOfEmployees: Realistic range based on company type
- AnnualRevenue: Realistic range in USD
- Description: Brief company description
- Type: Customer, Prospect, or Partner

Include a "_localId" field for each record (e.g., "Account_1", "Account_2") for relationship tracking.`,

      Contact: `Generate Contact records with these fields:
- FirstName, LastName: Realistic fictional names
- Email: Format firstname.lastname@{company}-demo.com
- Phone: Format 555-XXX-XXXX
- Title: Realistic job titles relevant to B2B sales
- Department: Sales, Marketing, IT, Finance, Operations, or Executive
- LeadSource: Web, Partner Referral, Trade Show, or Cold Call
- _localId: Unique identifier (e.g., "Contact_1")
- _parentLocalId: Reference to parent Account's _localId

Generate varied seniority levels (C-suite, VP, Director, Manager) appropriate for deal involvement.`,

      Opportunity: `Generate Opportunity (deal) records with these fields:
- Name: Deal name format "[Company] - [Product/Service]"
- StageName: Prospecting, Qualification, Needs Analysis, Value Proposition, Negotiation, or Closed Won
- Amount: Deal value in USD (realistic range)
- CloseDate: Future date in YYYY-MM-DD format
- Probability: Percentage based on stage (10-100)
- Type: New Business or Existing Business
- LeadSource: Web, Partner Referral, Trade Show, or Cold Call
- Description: Brief opportunity description
- _localId: Unique identifier (e.g., "Opportunity_1")
- _parentLocalId: Reference to parent Account's _localId

Vary the stages and amounts realistically.`,

      Task: `Generate Task (activity) records with these fields:
- Subject: Action-oriented task name
- Status: Not Started, In Progress, or Completed
- Priority: High, Normal, or Low
- ActivityDate: Date in YYYY-MM-DD format
- Description: Task details and notes
- Type: Call, Email, or Meeting
- _localId: Unique identifier
- WhoId_localId: Reference to related Contact's _localId
- WhatId_localId: Reference to related Opportunity's _localId (optional)

For tasks with Type "Call", include call-related details in Description.`,

      Event: `Generate Event (meeting) records with these fields:
- Subject: Meeting topic
- StartDateTime: ISO 8601 format
- EndDateTime: ISO 8601 format (30-60 minutes after start)
- Location: Virtual or physical location
- Description: Meeting agenda and notes
- Type: Meeting, Demo, or Call
- _localId: Unique identifier
- WhoId_localId: Reference to related Contact's _localId
- WhatId_localId: Reference to related Opportunity's _localId

Create realistic meeting scenarios (discovery calls, demos, contract reviews).`,
    };

    return basePrompt + (objectSpecificPrompts[objectType] || `Generate ${objectType} records.`);
  }

  private interpolatePrompt(
    template: string,
    variables: Record<string, string | number>,
  ): string {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
      const value = variables[key];
      return value !== undefined ? String(value) : '';
    });
  }

  private buildContext(objectType: string, existingRecords: Map<string, any[]>): string {
    // Add context from existing records
    if (objectType === 'Contact' && existingRecords.has('Account')) {
      const accounts = existingRecords.get('Account')!;
      return `These contacts should be distributed across these accounts (use their _localId for _parentLocalId):
${JSON.stringify(accounts.map((a) => ({ _localId: a._localId, Name: a.Name })), null, 2)}

Generate 2-4 contacts per account with varied roles.

`;
    }

    if (objectType === 'Opportunity' && existingRecords.has('Account')) {
      const accounts = existingRecords.get('Account')!;
      return `These opportunities should be linked to these accounts (use their _localId for _parentLocalId):
${JSON.stringify(accounts.map((a) => ({ _localId: a._localId, Name: a.Name })), null, 2)}

Create 1-2 opportunities per account with varied stages.

`;
    }

    if ((objectType === 'Task' || objectType === 'Event') && existingRecords.has('Contact')) {
      const contacts = existingRecords.get('Contact')!;
      const opportunities = existingRecords.get('Opportunity') || [];

      return `Link these activities to contacts (WhoId_localId) and optionally opportunities (WhatId_localId):

Contacts:
${JSON.stringify(contacts.map((c) => ({ _localId: c._localId, Name: `${c.FirstName} ${c.LastName}` })), null, 2)}

${opportunities.length > 0 ? `Opportunities:\n${JSON.stringify(opportunities.map((o) => ({ _localId: o._localId, Name: o.Name })), null, 2)}` : ''}

Distribute activities across contacts realistically.

`;
    }

    return '';
  }

  private getUserPrompt(
    objectType: string,
    count: number,
    existingRecords: Map<string, any[]>,
    industry: string,
    scenario: string,
  ): string {
    let prompt = `Generate exactly ${count} ${objectType} records for a ${industry} sales scenario.

Scenario: ${scenario}

`;

    // Add context from existing records
    if (objectType === 'Contact' && existingRecords.has('Account')) {
      const accounts = existingRecords.get('Account')!;
      prompt += `These contacts should be distributed across these accounts (use their _localId for _parentLocalId):
${JSON.stringify(accounts.map((a) => ({ _localId: a._localId, Name: a.Name })), null, 2)}

Generate 2-4 contacts per account with varied roles.\n\n`;
    }

    if (objectType === 'Opportunity' && existingRecords.has('Account')) {
      const accounts = existingRecords.get('Account')!;
      prompt += `These opportunities should be linked to these accounts (use their _localId for _parentLocalId):
${JSON.stringify(accounts.map((a) => ({ _localId: a._localId, Name: a.Name })), null, 2)}

Create 1-2 opportunities per account with varied stages.\n\n`;
    }

    if ((objectType === 'Task' || objectType === 'Event') && existingRecords.has('Contact')) {
      const contacts = existingRecords.get('Contact')!;
      const opportunities = existingRecords.get('Opportunity') || [];

      prompt += `Link these activities to contacts (WhoId_localId) and optionally opportunities (WhatId_localId):

Contacts:
${JSON.stringify(contacts.map((c) => ({ _localId: c._localId, Name: `${c.FirstName} ${c.LastName}` })), null, 2)}

${opportunities.length > 0 ? `Opportunities:\n${JSON.stringify(opportunities.map((o) => ({ _localId: o._localId, Name: o.Name })), null, 2)}` : ''}

Distribute activities across contacts realistically.\n\n`;
    }

    prompt += `Return as JSON: { "records": [...] }

Ensure each record has a unique _localId for tracking.`;

    return prompt;
  }

  private getRecordSchema(objectType: string): Record<string, any> {
    const base: Record<string, any> = {
      type: 'object',
      additionalProperties: true,
    };

    switch (objectType) {
      case 'Account':
        return {
          ...base,
          required: ['Name'],
          properties: {
            Name: { type: 'string' },
            Industry: { type: 'string' },
            Website: { type: 'string' },
            Phone: { type: 'string' },
            _localId: { type: 'string' },
          },
        };
      case 'Contact':
        return {
          ...base,
          required: ['LastName', '_parentLocalId'],
          properties: {
            FirstName: { type: 'string' },
            LastName: { type: 'string' },
            Email: { type: 'string' },
            _localId: { type: 'string' },
            _parentLocalId: { type: 'string' },
          },
        };
      case 'Opportunity':
        return {
          ...base,
          required: ['Name', 'StageName', 'CloseDate', '_parentLocalId'],
          properties: {
            Name: { type: 'string' },
            StageName: { type: 'string' },
            CloseDate: { type: 'string' },
            _localId: { type: 'string' },
            _parentLocalId: { type: 'string' },
          },
        };
      case 'Task':
        return {
          ...base,
          required: ['Subject'],
          properties: {
            Subject: { type: 'string' },
            Status: { type: 'string' },
            ActivityDate: { type: 'string' },
            WhoId_localId: { type: 'string' },
            WhatId_localId: { type: 'string' },
          },
        };
      case 'Event':
        return {
          ...base,
          required: ['Subject', 'StartDateTime', 'EndDateTime'],
          properties: {
            Subject: { type: 'string' },
            StartDateTime: { type: 'string' },
            EndDateTime: { type: 'string' },
            WhoId_localId: { type: 'string' },
            WhatId_localId: { type: 'string' },
          },
        };
      case 'EmailMessage':
        return {
          ...base,
          required: ['Subject', 'TextBody', 'RelatedToId_localId'],
          properties: {
            Subject: { type: 'string' },
            TextBody: { type: 'string' },
            FromAddress: { type: 'string' },
            ToAddress: { type: 'string' },
            RelatedToId_localId: { type: 'string' },
          },
        };
      default:
        return base;
    }
  }

  buildEmailPrompt(
    context: {
      account: any;
      contact: any;
      opportunity: any;
    },
    emailCount: number,
  ): GenerationPrompt {
    return {
      systemPrompt: `You are generating realistic sales email threads for demo purposes.
Generate professional B2B sales emails that feel authentic.
All data must be fictional - do not use real information.`,

      userPrompt: `Generate a ${emailCount}-email thread for this sales scenario:

Account: ${context.account.Name} (${context.account.Industry})
Contact: ${context.contact.FirstName} ${context.contact.LastName} (${context.contact.Title})
Opportunity: ${context.opportunity.Name} (Stage: ${context.opportunity.StageName})

For each email, provide:
- subject: Email subject line
- body: Full email body (professional tone)
- direction: "inbound" (from customer) or "outbound" (from sales rep)
- timestamp: ISO 8601 date (space out over 1-2 weeks)

Start with an outbound email. Make the conversation realistic for the sales stage.

Return as JSON: { "emails": [...] }`,

      temperature: 0.8,
    };
  }

  buildCallTranscriptPrompt(
    context: {
      account: any;
      contact: any;
      opportunity: any;
      callType: string;
    },
    durationMinutes: number,
  ): GenerationPrompt {
    return {
      systemPrompt: `You are generating realistic sales call transcripts for demo purposes.
Create authentic-sounding dialogue between a sales rep and a prospect.
All data must be fictional.`,

      userPrompt: `Generate a ${durationMinutes}-minute ${context.callType} call transcript:

Account: ${context.account.Name} (${context.account.Industry})
Contact: ${context.contact.FirstName} ${context.contact.LastName} (${context.contact.Title})
Opportunity: ${context.opportunity.Name} (Stage: ${context.opportunity.StageName})

Format as dialogue with speaker labels:
"Rep: [dialogue]"
"${context.contact.FirstName}: [dialogue]"

Also provide a brief summary and next steps.

Return as JSON:
{
  "transcript": "Full transcript...",
  "summary": "2-3 sentence summary",
  "nextSteps": ["Step 1", "Step 2"],
  "duration": ${durationMinutes}
}`,

      temperature: 0.8,
    };
  }
}
