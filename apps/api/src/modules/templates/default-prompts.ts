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

  [SalesforceObject.LEAD]: `${BASE_SYSTEM_PROMPT}Generate Lead (prospective customer) records with these fields:
- FirstName, LastName: Realistic fictional names
- Company: Realistic fictional company name
- Title: Job title
- Email: Format firstname.lastname@company-demo.com
- Phone: Format 555-XXX-XXXX
- Status: "Open - Not Contacted", "Working - Contacted", "Closed - Converted", or "Closed - Not Converted"
- LeadSource: Web, Partner Referral, Trade Show, Cold Call, Employee Referral, or Advertisement
- Industry: Industry of the lead's company
- Rating: Hot, Warm, or Cold
- NumberOfEmployees: Company size
- AnnualRevenue: Estimated company revenue
- Street, City, State, PostalCode, Country: Address fields
- Description: Notes about the lead
- _localId: Unique identifier (e.g., "Lead_1")

Generate leads at various stages of qualification with realistic company and contact information.`,

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

  [SalesforceObject.CASE]: `${BASE_SYSTEM_PROMPT}Generate Case (support ticket) records with these fields:
- Subject: Brief case description
- Description: Detailed problem description
- Status: New, Working, Escalated, or Closed
- Priority: Low, Medium, or High
- Origin: Phone, Email, Web, or Chat
- Type: Problem, Feature Request, or Question
- Reason: User didn't attend training, Complex functionality, or Existing problem
- AccountId_localId: Reference to parent Account's _localId
- ContactId_localId: Reference to related Contact's _localId
- _localId: Unique identifier (e.g., "Case_1")

Generate realistic support scenarios relevant to B2B software.`,

  [SalesforceObject.CAMPAIGN]: `${BASE_SYSTEM_PROMPT}Generate Campaign (marketing campaign) records with these fields:
- Name: Campaign name
- Type: Conference, Webinar, Trade Show, Public Relations, Partners, Referral Program, Advertisement, Banner Ads, Direct Mail, Email, or Other
- Status: Planned, In Progress, Completed, or Aborted
- StartDate: Campaign start date (YYYY-MM-DD)
- EndDate: Campaign end date (YYYY-MM-DD)
- ExpectedRevenue: Projected revenue from campaign
- BudgetedCost: Allocated budget
- ActualCost: Actual spending (if In Progress or Completed)
- ExpectedResponse: Expected response rate (percentage)
- NumberSent: Number of campaign members
- Description: Campaign description and goals
- IsActive: true or false
- _localId: Unique identifier (e.g., "Campaign_1")

Generate realistic marketing campaigns typical for B2B sales.`,

  [SalesforceObject.CAMPAIGN_MEMBER]: `${BASE_SYSTEM_PROMPT}Generate CampaignMember (campaign participant) records with these fields:
- Status: Sent or Responded
- HasResponded: true or false
- FirstRespondedDate: Date of first response (if responded, YYYY-MM-DD)
- CampaignId_localId: Reference to Campaign's _localId
- LeadId_localId: Reference to Lead's _localId (if lead)
- ContactId_localId: Reference to Contact's _localId (if contact, mutually exclusive with LeadId)
- _localId: Unique identifier (e.g., "CampaignMember_1")

Link either Leads OR Contacts to Campaigns, not both for the same member.`,

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
- ParentId_localId: Reference to related Opportunity's _localId
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
