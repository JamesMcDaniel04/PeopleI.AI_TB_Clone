import { SalesforceObject } from './entities/template-prompt.entity';

export interface TemplatePromptSeed {
  salesforceObject: SalesforceObject;
  systemPrompt: string;
  userPromptTemplate: string;
  temperature: number;
  outputSchema?: Record<string, any>;
}

const BASE_SYSTEM_PROMPT = `You are a B2B sales data specialist generating realistic {{industry}} sales data for Salesforce CRM demos.

CRITICAL RULES:
1. All data must be FICTIONAL - do not use real company names, real person names, or real contact information
2. Generate PII-free data suitable for demo environments
3. Use realistic but fake phone numbers (555-XXX-XXXX format)
4. Use realistic but fake email domains (@example.com, @acme-demo.com, @techcorp-demo.com)
5. Maintain consistency in industry terminology and typical sales patterns
6. Return data as JSON with a "records" array

`;

const USER_PROMPT_TEMPLATE = `Generate exactly {{count}} {{objectType}} records for a {{industry}} sales scenario.

Scenario: {{scenario}}

{{context}}
Return as JSON: { "records": [...] }

Ensure each record has a unique _localId for tracking.`;

const SYSTEM_PROMPTS: Record<SalesforceObject, string> = {
  [SalesforceObject.ACCOUNT]: `${BASE_SYSTEM_PROMPT}Generate Account (company) records with these fields:
- Name: Realistic fictional company name (NOT real companies like Google, Microsoft, etc.)
- Industry: {{industry}} or related sub-industry
- Website: Fake but realistic domain (use -demo.com suffix)
- Phone: Format 555-XXX-XXXX
- BillingStreet, BillingCity, BillingState, BillingPostalCode, BillingCountry
- NumberOfEmployees: Realistic range based on company type
- AnnualRevenue: Realistic range in USD
- Description: Brief company description
- Type: Customer, Prospect, or Partner

Include a "_localId" field for each record (e.g., "Account_1", "Account_2") for relationship tracking.`,

  [SalesforceObject.CONTACT]: `${BASE_SYSTEM_PROMPT}Generate Contact records with these fields:
- FirstName, LastName: Realistic fictional names
- Email: Format firstname.lastname@{company}-demo.com
- Phone: Format 555-XXX-XXXX
- Title: Realistic job titles relevant to B2B sales
- Department: Sales, Marketing, IT, Finance, Operations, or Executive
- LeadSource: Web, Partner Referral, Trade Show, or Cold Call
- _localId: Unique identifier (e.g., "Contact_1")
- _parentLocalId: Reference to parent Account's _localId

Generate varied seniority levels (C-suite, VP, Director, Manager) appropriate for deal involvement.`,

  [SalesforceObject.OPPORTUNITY]: `${BASE_SYSTEM_PROMPT}Generate Opportunity (deal) records with these fields:
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

  [SalesforceObject.TASK]: `${BASE_SYSTEM_PROMPT}Generate Task (activity) records with these fields:
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

  [SalesforceObject.EVENT]: `${BASE_SYSTEM_PROMPT}Generate Event (meeting) records with these fields:
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

  [SalesforceObject.EMAIL_MESSAGE]: `${BASE_SYSTEM_PROMPT}Generate EmailMessage records with these fields:
- Subject: Email subject line
- TextBody: Full email content
- ToAddress, FromAddress: Use demo-safe domains
- MessageDate: ISO 8601 timestamp
- RelatedToId_localId: Reference to related Opportunity's _localId
- _localId: Unique identifier

All emails must be fictional and demo-safe.`,
};

export const DEFAULT_TEMPLATE_PROMPTS: TemplatePromptSeed[] = Object.entries(SYSTEM_PROMPTS).map(
  ([salesforceObject, systemPrompt]) => ({
    salesforceObject: salesforceObject as SalesforceObject,
    systemPrompt,
    userPromptTemplate: USER_PROMPT_TEMPLATE,
    temperature: 0.7,
  }),
);

export function getDefaultTemplatePrompt(
  objectType: SalesforceObject | string,
): TemplatePromptSeed | undefined {
  const normalized = objectType as SalesforceObject;
  return DEFAULT_TEMPLATE_PROMPTS.find((prompt) => prompt.salesforceObject === normalized);
}
