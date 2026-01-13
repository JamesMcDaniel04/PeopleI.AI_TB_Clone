export const SALESFORCE_OBJECTS = {
  ACCOUNT: 'Account',
  CONTACT: 'Contact',
  OPPORTUNITY: 'Opportunity',
  TASK: 'Task',
  EVENT: 'Event',
  EMAIL_MESSAGE: 'EmailMessage',
} as const;

export const INJECTION_ORDER = [
  'Account',
  'Contact',
  'Opportunity',
  'Task',
  'Event',
  'EmailMessage',
] as const;

export const CLEANUP_ORDER = [
  'EmailMessage',
  'Event',
  'Task',
  'Opportunity',
  'Contact',
  'Account',
] as const;

export const RELATIONSHIP_FIELDS: Record<string, Record<string, string>> = {
  Contact: { AccountId: 'Account' },
  Opportunity: { AccountId: 'Account' },
  Task: { WhoId: 'Contact', WhatId: 'Opportunity' },
  Event: { WhoId: 'Contact', WhatId: 'Opportunity' },
  EmailMessage: { RelatedToId: 'Opportunity' },
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
