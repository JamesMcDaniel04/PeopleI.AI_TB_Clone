export interface SalesforceAccount {
  Id?: string;
  Name: string;
  Industry?: string;
  Website?: string;
  Phone?: string;
  BillingStreet?: string;
  BillingCity?: string;
  BillingState?: string;
  BillingPostalCode?: string;
  BillingCountry?: string;
  NumberOfEmployees?: number;
  AnnualRevenue?: number;
  Description?: string;
  Type?: 'Customer' | 'Prospect' | 'Partner';
}

export interface SalesforceContact {
  Id?: string;
  FirstName: string;
  LastName: string;
  Email?: string;
  Phone?: string;
  Title?: string;
  Department?: string;
  AccountId?: string;
  LeadSource?: string;
}

export interface SalesforceOpportunity {
  Id?: string;
  Name: string;
  StageName: string;
  Amount?: number;
  CloseDate: string;
  Probability?: number;
  Type?: string;
  LeadSource?: string;
  Description?: string;
  AccountId?: string;
}

export interface SalesforceTask {
  Id?: string;
  Subject: string;
  Status: 'Not Started' | 'In Progress' | 'Completed' | 'Waiting on someone else' | 'Deferred';
  Priority?: 'High' | 'Normal' | 'Low';
  ActivityDate?: string;
  Description?: string;
  Type?: string;
  WhoId?: string;
  WhatId?: string;
}

export interface SalesforceEvent {
  Id?: string;
  Subject: string;
  StartDateTime: string;
  EndDateTime: string;
  Location?: string;
  Description?: string;
  Type?: string;
  WhoId?: string;
  WhatId?: string;
}

export type SalesforceObject =
  | SalesforceAccount
  | SalesforceContact
  | SalesforceOpportunity
  | SalesforceTask
  | SalesforceEvent;

export type SalesforceObjectType = 'Account' | 'Contact' | 'Opportunity' | 'Task' | 'Event' | 'EmailMessage';

export interface SalesforceConnectionConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  loginUrl: string;
}

export interface SalesforceTokens {
  accessToken: string;
  refreshToken: string;
  instanceUrl: string;
  expiresAt: Date;
}
