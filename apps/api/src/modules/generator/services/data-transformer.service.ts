import { Injectable, Logger } from '@nestjs/common';

interface GeneratedRecord {
  _localId?: string;
  _parentLocalId?: string;
  [key: string]: any;
}

@Injectable()
export class DataTransformerService {
  private readonly logger = new Logger(DataTransformerService.name);

  transformToSalesforceFormat(
    gptResponse: { records: GeneratedRecord[] },
    objectType: string,
    existingRecords: Map<string, any[]>,
  ): GeneratedRecord[] {
    const records = gptResponse.records || [];

    return records.map((record, index) => {
      // Ensure local ID exists
      const localId = record._localId || `${objectType}_${Date.now()}_${index}`;

      // Transform based on object type
      const transformed = this.transformRecord(record, objectType);

      return {
        _localId: localId,
        _parentLocalId: record._parentLocalId || null,
        ...transformed,
      };
    });
  }

  private transformRecord(record: GeneratedRecord, objectType: string): Record<string, any> {
    const { _localId, _parentLocalId, ...data } = record;

    switch (objectType) {
      case 'Account':
        return this.transformAccount(data);
      case 'Contact':
        return this.transformContact(data);
      case 'Opportunity':
        return this.transformOpportunity(data);
      case 'Task':
        return this.transformTask(data);
      case 'Event':
        return this.transformEvent(data);
      case 'EmailMessage':
        return this.transformEmailMessage(data);
      case 'Lead':
        return this.transformLead(data);
      case 'Case':
        return this.transformCase(data);
      case 'Campaign':
        return this.transformCampaign(data);
      case 'CampaignMember':
        return this.transformCampaignMember(data);
      default:
        return data;
    }
  }

  private transformAccount(record: Record<string, any>): Record<string, any> {
    return {
      Name: record.Name,
      Industry: record.Industry,
      Website: this.sanitizeUrl(record.Website),
      Phone: this.formatPhone(record.Phone),
      BillingStreet: record.BillingStreet,
      BillingCity: record.BillingCity,
      BillingState: record.BillingState,
      BillingPostalCode: record.BillingPostalCode,
      BillingCountry: record.BillingCountry || 'USA',
      NumberOfEmployees: this.parseNumber(record.NumberOfEmployees),
      AnnualRevenue: this.parseNumber(record.AnnualRevenue),
      Description: record.Description,
      Type: record.Type || 'Prospect',
    };
  }

  private transformContact(record: Record<string, any>): Record<string, any> {
    return {
      FirstName: record.FirstName,
      LastName: record.LastName,
      Email: this.sanitizeEmail(record.Email),
      Phone: this.formatPhone(record.Phone),
      Title: record.Title,
      Department: record.Department,
      LeadSource: record.LeadSource,
      // Relationship fields will be mapped during injection
      _parentLocalId: record._parentLocalId,
    };
  }

  private transformOpportunity(record: Record<string, any>): Record<string, any> {
    return {
      Name: record.Name,
      StageName: this.validateStage(record.StageName),
      Amount: this.parseNumber(record.Amount),
      CloseDate: this.formatDate(record.CloseDate),
      Probability: this.parseNumber(record.Probability),
      Type: record.Type || 'New Business',
      LeadSource: record.LeadSource,
      Description: record.Description,
      _parentLocalId: record._parentLocalId,
    };
  }

  private transformTask(record: Record<string, any>): Record<string, any> {
    return {
      Subject: record.Subject,
      Status: this.validateTaskStatus(record.Status),
      Priority: record.Priority || 'Normal',
      ActivityDate: this.formatDate(record.ActivityDate),
      Description: record.Description,
      Type: record.Type,
      // Store relationship local IDs for later mapping
      WhoId_localId: record.WhoId_localId,
      WhatId_localId: record.WhatId_localId,
    };
  }

  private transformEvent(record: Record<string, any>): Record<string, any> {
    return {
      Subject: record.Subject,
      StartDateTime: this.formatDateTime(record.StartDateTime),
      EndDateTime: this.formatDateTime(record.EndDateTime),
      Location: record.Location,
      Description: record.Description,
      Type: record.Type,
      WhoId_localId: record.WhoId_localId,
      WhatId_localId: record.WhatId_localId,
    };
  }

  private transformEmailMessage(record: Record<string, any>): Record<string, any> {
    return {
      Subject: record.Subject,
      TextBody: record.TextBody || record.Body || record.Description,
      FromAddress: this.sanitizeEmail(record.FromAddress),
      ToAddress: this.sanitizeEmail(record.ToAddress),
      MessageDate: this.formatDateTime(record.MessageDate),
      Incoming: this.parseBoolean(record.Incoming),
      RelatedToId_localId: record.RelatedToId_localId,
    };
  }

  private transformLead(record: Record<string, any>): Record<string, any> {
    return {
      FirstName: record.FirstName,
      LastName: record.LastName,
      Company: record.Company,
      Title: record.Title,
      Email: this.sanitizeEmail(record.Email),
      Phone: this.formatPhone(record.Phone),
      Status: this.validateLeadStatus(record.Status),
      LeadSource: record.LeadSource,
      Industry: record.Industry,
      Rating: record.Rating || 'Warm',
      NumberOfEmployees: this.parseNumber(record.NumberOfEmployees),
      AnnualRevenue: this.parseNumber(record.AnnualRevenue),
      Street: record.Street,
      City: record.City,
      State: record.State,
      PostalCode: record.PostalCode,
      Country: record.Country || 'USA',
      Description: record.Description,
    };
  }

  private transformCase(record: Record<string, any>): Record<string, any> {
    return {
      Subject: record.Subject,
      Description: record.Description,
      Status: this.validateCaseStatus(record.Status),
      Priority: record.Priority || 'Medium',
      Origin: record.Origin || 'Web',
      Type: record.Type,
      Reason: record.Reason,
      AccountId_localId: record.AccountId_localId,
      ContactId_localId: record.ContactId_localId,
    };
  }

  private transformCampaign(record: Record<string, any>): Record<string, any> {
    return {
      Name: record.Name,
      Type: record.Type || 'Other',
      Status: this.validateCampaignStatus(record.Status),
      StartDate: this.formatDate(record.StartDate),
      EndDate: this.formatDate(record.EndDate),
      ExpectedRevenue: this.parseNumber(record.ExpectedRevenue),
      BudgetedCost: this.parseNumber(record.BudgetedCost),
      ActualCost: this.parseNumber(record.ActualCost),
      ExpectedResponse: this.parseNumber(record.ExpectedResponse),
      NumberSent: this.parseNumber(record.NumberSent),
      Description: record.Description,
      IsActive: this.parseBoolean(record.IsActive) ?? true,
    };
  }

  private transformCampaignMember(record: Record<string, any>): Record<string, any> {
    return {
      Status: record.Status || 'Sent',
      HasResponded: this.parseBoolean(record.HasResponded) ?? false,
      FirstRespondedDate: record.FirstRespondedDate ? this.formatDate(record.FirstRespondedDate) : null,
      CampaignId_localId: record.CampaignId_localId,
      LeadId_localId: record.LeadId_localId,
      ContactId_localId: record.ContactId_localId,
    };
  }

  private sanitizeEmail(email: string): string {
    if (!email) {
      return 'demo@example.com';
    }

    const parts = email.split('@');
    if (parts.length !== 2) {
      return 'demo@example.com';
    }

    const domain = parts[1].toLowerCase();

    // Safe demo domains
    const safeDomains = [
      'example.com',
      'example.org',
      'demo.com',
      'test.com',
      'acme-demo.com',
      'techcorp-demo.com',
    ];

    if (safeDomains.some((safe) => domain.endsWith(safe) || domain.includes('-demo.'))) {
      return email.toLowerCase();
    }

    // Replace with safe domain
    return `${parts[0].toLowerCase()}@example.com`;
  }

  private sanitizeUrl(url: string): string {
    if (!url) {
      return 'https://www.example.com';
    }

    // Ensure it uses a demo-safe domain
    if (!url.includes('-demo.') && !url.includes('example.')) {
      return 'https://www.example.com';
    }

    return url;
  }

  private formatPhone(phone: string): string {
    if (!phone) {
      return '555-100-1000';
    }

    // Extract digits
    const digits = phone.replace(/\D/g, '');

    // Ensure it's a safe demo number (555 prefix)
    if (digits.length >= 10) {
      return `555-${digits.slice(-7, -4)}-${digits.slice(-4)}`;
    }

    return '555-100-1000';
  }

  private parseNumber(value: any): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;

    return isNaN(num) ? null : num;
  }

  private formatDate(dateStr: string): string {
    if (!dateStr) {
      // Default to 30 days from now
      const future = new Date();
      future.setDate(future.getDate() + 30);
      return future.toISOString().split('T')[0];
    }

    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        const future = new Date();
        future.setDate(future.getDate() + 30);
        return future.toISOString().split('T')[0];
      }
      return date.toISOString().split('T')[0];
    } catch {
      const future = new Date();
      future.setDate(future.getDate() + 30);
      return future.toISOString().split('T')[0];
    }
  }

  private formatDateTime(dateTimeStr: string): string {
    if (!dateTimeStr) {
      const future = new Date();
      future.setDate(future.getDate() + 7);
      return future.toISOString();
    }

    try {
      const date = new Date(dateTimeStr);
      if (isNaN(date.getTime())) {
        const future = new Date();
        future.setDate(future.getDate() + 7);
        return future.toISOString();
      }
      return date.toISOString();
    } catch {
      const future = new Date();
      future.setDate(future.getDate() + 7);
      return future.toISOString();
    }
  }

  private validateStage(stage: string): string {
    const validStages = [
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
    ];

    if (!stage || !validStages.includes(stage)) {
      return 'Prospecting';
    }

    return stage;
  }

  private validateTaskStatus(status: string): string {
    const validStatuses = ['Not Started', 'In Progress', 'Completed', 'Waiting on someone else', 'Deferred'];

    if (!status || !validStatuses.includes(status)) {
      return 'Not Started';
    }

    return status;
  }

  private validateLeadStatus(status: string): string {
    const validStatuses = [
      'Open - Not Contacted',
      'Working - Contacted',
      'Closed - Converted',
      'Closed - Not Converted',
    ];

    if (!status || !validStatuses.includes(status)) {
      return 'Open - Not Contacted';
    }

    return status;
  }

  private validateCaseStatus(status: string): string {
    const validStatuses = ['New', 'Working', 'Escalated', 'Closed'];

    if (!status || !validStatuses.includes(status)) {
      return 'New';
    }

    return status;
  }

  private validateCampaignStatus(status: string): string {
    const validStatuses = ['Planned', 'In Progress', 'Completed', 'Aborted'];

    if (!status || !validStatuses.includes(status)) {
      return 'Planned';
    }

    return status;
  }

  private parseBoolean(value: any): boolean | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'n'].includes(normalized)) {
        return false;
      }
    }
    return null;
  }

  /**
   * Generate email records from email thread data
   */
  generateEmailRecords(
    emails: { subject: string; body: string; direction: string; timestamp?: string }[],
    contactEmail: string,
    salesRepEmail: string,
    opportunityLocalId: string,
  ): Record<string, any>[] {
    const sanitizedContactEmail = this.sanitizeEmail(contactEmail);
    const sanitizedRepEmail = this.sanitizeEmail(salesRepEmail);

    return emails.map((email, index) => {
      const direction = (email.direction || '').toLowerCase();
      const isInbound = direction === 'inbound';
      const subject = email.subject || `Follow up ${index + 1}`;
      const body = email.body || 'Email content not provided.';

      return {
        _localId: `EmailMessage_${Date.now()}_${index}`,
        Subject: subject,
        TextBody: body,
        FromAddress: isInbound ? sanitizedContactEmail : sanitizedRepEmail,
        ToAddress: isInbound ? sanitizedRepEmail : sanitizedContactEmail,
        MessageDate: this.formatDateTime(email.timestamp || new Date().toISOString()),
        Incoming: isInbound,
        RelatedToId_localId: opportunityLocalId,
      };
    });
  }

  /**
   * Generate call task record from transcript data
   */
  generateCallRecord(
    callData: { transcript: string; summary: string; duration: number },
    contactLocalId: string,
    opportunityLocalId: string,
    subject: string,
  ): Record<string, any> {
    return {
      _localId: `Call_${Date.now()}`,
      Subject: subject,
      Description: `${callData.summary}\n\n--- TRANSCRIPT ---\n${callData.transcript}`,
      Status: 'Completed',
      Priority: 'Normal',
      ActivityDate: this.formatDate(new Date().toISOString()),
      Type: 'Call',
      WhoId_localId: contactLocalId,
      WhatId_localId: opportunityLocalId,
      // Custom tracking
      _callDuration: callData.duration,
    };
  }
}
