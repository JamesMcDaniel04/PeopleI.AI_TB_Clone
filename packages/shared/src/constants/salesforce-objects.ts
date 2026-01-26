export const SALESFORCE_OBJECTS = {
  ACCOUNT: 'Account',
  CONTACT: 'Contact',
  LEAD: 'Lead',
  OPPORTUNITY: 'Opportunity',
  CASE: 'Case',
  CAMPAIGN: 'Campaign',
  CAMPAIGN_MEMBER: 'CampaignMember',
  TASK: 'Task',
  EVENT: 'Event',
  EMAIL_MESSAGE: 'EmailMessage',
} as const;

export const INJECTION_ORDER = [
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
] as const;

export const CLEANUP_ORDER = [
  'EmailMessage',
  'Event',
  'Task',
  'CampaignMember',
  'Case',
  'Opportunity',
  'Campaign',
  'Lead',
  'Contact',
  'Account',
] as const;

export const RELATIONSHIP_FIELDS: Record<string, Record<string, string>> = {
  Contact: { AccountId: 'Account' },
  Lead: {},
  Opportunity: { AccountId: 'Account' },
  Case: { AccountId: 'Account', ContactId: 'Contact' },
  Campaign: {},
  CampaignMember: { CampaignId: 'Campaign', LeadId: 'Lead', ContactId: 'Contact' },
  Task: { WhoId: 'Contact', WhatId: 'Opportunity' },
  Event: { WhoId: 'Contact', WhatId: 'Opportunity' },
  EmailMessage: { ParentId: 'Opportunity' },
};

export const OPPORTUNITY_STAGES = [
  'Prospecting',
  'Qualification',
  'Needs Analysis',
  'Value Proposition',
  'Id. Decision Makers',
  'Perception Analysis',
  'Proposal/Price Quote',
  'Negotiation/Review',
  'Closed Won',
  'Closed Lost',
] as const;

export const TASK_STATUSES = [
  'Not Started',
  'In Progress',
  'Completed',
  'Waiting on someone else',
  'Deferred',
] as const;

export const LEAD_SOURCES = [
  'Web',
  'Partner Referral',
  'Trade Show',
  'Cold Call',
  'Employee Referral',
  'Advertisement',
  'Other',
] as const;

export const LEAD_STATUSES = [
  'Open - Not Contacted',
  'Working - Contacted',
  'Closed - Converted',
  'Closed - Not Converted',
] as const;

export const CASE_STATUSES = [
  'New',
  'Working',
  'Escalated',
  'Closed',
] as const;

export const CASE_PRIORITIES = [
  'Low',
  'Medium',
  'High',
] as const;

export const CASE_ORIGINS = [
  'Phone',
  'Email',
  'Web',
  'Chat',
] as const;

export const CAMPAIGN_TYPES = [
  'Conference',
  'Webinar',
  'Trade Show',
  'Public Relations',
  'Partners',
  'Referral Program',
  'Advertisement',
  'Banner Ads',
  'Direct Mail',
  'Email',
  'Other',
] as const;

export const CAMPAIGN_STATUSES = [
  'Planned',
  'In Progress',
  'Completed',
  'Aborted',
] as const;

export const CAMPAIGN_MEMBER_STATUSES = [
  'Sent',
  'Responded',
] as const;
