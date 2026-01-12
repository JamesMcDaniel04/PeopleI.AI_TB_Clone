import { Injectable, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { SalesforceAuthService } from './salesforce-auth.service';

interface SalesforceCreateResult {
  id: string;
  success: boolean;
  errors: { message: string; statusCode: string }[];
}

interface SalesforceCompositeResult {
  compositeResponse: {
    body: SalesforceCreateResult | SalesforceCreateResult[];
    httpStatusCode: number;
    referenceId: string;
  }[];
}

@Injectable()
export class SalesforceRestApiService {
  private readonly apiVersion = 'v59.0';

  constructor(
    private httpService: HttpService,
    private authService: SalesforceAuthService,
  ) {}

  async createRecord(
    environmentId: string,
    objectType: string,
    data: Record<string, any>,
  ): Promise<SalesforceCreateResult> {
    const accessToken = await this.authService.getAccessToken(environmentId);
    const instanceUrl = await this.authService.getInstanceUrl(environmentId);

    const url = `${instanceUrl}/services/data/${this.apiVersion}/sobjects/${objectType}`;

    try {
      const response = await firstValueFrom(
        this.httpService.post<SalesforceCreateResult>(url, data, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.[0]?.message || error.message;
      throw new BadRequestException(`Failed to create ${objectType}: ${errorMessage}`);
    }
  }

  async createRecords(
    environmentId: string,
    objectType: string,
    records: Record<string, any>[],
  ): Promise<SalesforceCreateResult[]> {
    if (records.length === 0) {
      return [];
    }

    // Salesforce REST API supports max 200 records per request
    const batchSize = 200;
    const results: SalesforceCreateResult[] = [];

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchResults = await this.createRecordsBatch(environmentId, objectType, batch);
      results.push(...batchResults);
    }

    return results;
  }

  private async createRecordsBatch(
    environmentId: string,
    objectType: string,
    records: Record<string, any>[],
  ): Promise<SalesforceCreateResult[]> {
    const accessToken = await this.authService.getAccessToken(environmentId);
    const instanceUrl = await this.authService.getInstanceUrl(environmentId);

    const url = `${instanceUrl}/services/data/${this.apiVersion}/composite/sobjects`;

    const payload = {
      allOrNone: false,
      records: records.map((record) => ({
        attributes: { type: objectType },
        ...record,
      })),
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post<SalesforceCreateResult[]>(url, payload, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.[0]?.message || error.message;
      throw new BadRequestException(`Failed to create ${objectType} records: ${errorMessage}`);
    }
  }

  async getRecord(
    environmentId: string,
    objectType: string,
    recordId: string,
    fields?: string[],
  ): Promise<Record<string, any>> {
    const accessToken = await this.authService.getAccessToken(environmentId);
    const instanceUrl = await this.authService.getInstanceUrl(environmentId);

    let url = `${instanceUrl}/services/data/${this.apiVersion}/sobjects/${objectType}/${recordId}`;
    if (fields && fields.length > 0) {
      url += `?fields=${fields.join(',')}`;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      );

      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.[0]?.message || error.message;
      throw new BadRequestException(`Failed to get ${objectType}: ${errorMessage}`);
    }
  }

  async query(environmentId: string, soql: string): Promise<Record<string, any>[]> {
    const accessToken = await this.authService.getAccessToken(environmentId);
    const instanceUrl = await this.authService.getInstanceUrl(environmentId);

    const url = `${instanceUrl}/services/data/${this.apiVersion}/query`;

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: { q: soql },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      );

      return response.data.records;
    } catch (error: any) {
      const errorMessage = error.response?.data?.[0]?.message || error.message;
      throw new BadRequestException(`Query failed: ${errorMessage}`);
    }
  }

  async deleteRecord(
    environmentId: string,
    objectType: string,
    recordId: string,
  ): Promise<void> {
    const accessToken = await this.authService.getAccessToken(environmentId);
    const instanceUrl = await this.authService.getInstanceUrl(environmentId);

    const url = `${instanceUrl}/services/data/${this.apiVersion}/sobjects/${objectType}/${recordId}`;

    try {
      await firstValueFrom(
        this.httpService.delete(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      );
    } catch (error: any) {
      const errorMessage = error.response?.data?.[0]?.message || error.message;
      throw new BadRequestException(`Failed to delete ${objectType}: ${errorMessage}`);
    }
  }

  async deleteRecords(
    environmentId: string,
    objectType: string,
    recordIds: string[],
  ): Promise<{ success: boolean; id: string; errors?: any[] }[]> {
    if (recordIds.length === 0) {
      return [];
    }

    const accessToken = await this.authService.getAccessToken(environmentId);
    const instanceUrl = await this.authService.getInstanceUrl(environmentId);

    // Batch delete max 200 records
    const batchSize = 200;
    const results: { success: boolean; id: string; errors?: any[] }[] = [];

    for (let i = 0; i < recordIds.length; i += batchSize) {
      const batch = recordIds.slice(i, i + batchSize);
      const ids = batch.join(',');
      const url = `${instanceUrl}/services/data/${this.apiVersion}/composite/sobjects?ids=${ids}&allOrNone=false`;

      try {
        const response = await firstValueFrom(
          this.httpService.delete(url, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }),
        );

        results.push(...response.data);
      } catch (error: any) {
        // Add failed results for this batch
        batch.forEach((id) => {
          results.push({
            success: false,
            id,
            errors: [{ message: error.message }],
          });
        });
      }
    }

    return results;
  }

  async describeObject(
    environmentId: string,
    objectType: string,
  ): Promise<Record<string, any>> {
    const accessToken = await this.authService.getAccessToken(environmentId);
    const instanceUrl = await this.authService.getInstanceUrl(environmentId);

    const url = `${instanceUrl}/services/data/${this.apiVersion}/sobjects/${objectType}/describe`;

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      );

      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.[0]?.message || error.message;
      throw new BadRequestException(`Failed to describe ${objectType}: ${errorMessage}`);
    }
  }
}
