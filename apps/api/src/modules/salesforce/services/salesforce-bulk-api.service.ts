import { Injectable, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { SalesforceAuthService } from './salesforce-auth.service';

interface BulkJobInfo {
  id: string;
  operation: string;
  object: string;
  state: 'Open' | 'UploadComplete' | 'InProgress' | 'JobComplete' | 'Aborted' | 'Failed';
  numberRecordsProcessed?: number;
  numberRecordsFailed?: number;
}

interface BulkResult {
  sf__Id?: string;
  sf__Created?: boolean;
  sf__Error?: string;
  success: boolean;
  id?: string;
  errors?: string[];
}

@Injectable()
export class SalesforceBulkApiService {
  private readonly apiVersion = 'v59.0';

  constructor(
    private httpService: HttpService,
    private authService: SalesforceAuthService,
  ) {}

  async insertRecords(
    environmentId: string,
    objectType: string,
    records: Record<string, any>[],
  ): Promise<BulkResult[]> {
    if (records.length === 0) {
      return [];
    }

    const accessToken = await this.authService.getAccessToken(environmentId);
    const instanceUrl = await this.authService.getInstanceUrl(environmentId);

    // Create bulk job
    const job = await this.createJob(accessToken, instanceUrl, objectType, 'insert');

    try {
      // Upload data
      await this.uploadData(accessToken, instanceUrl, job.id, records);

      // Close job and wait for completion
      await this.closeJob(accessToken, instanceUrl, job.id);
      await this.waitForJobCompletion(accessToken, instanceUrl, job.id);

      // Get results
      return this.getJobResults(accessToken, instanceUrl, job.id, records.length);
    } catch (error) {
      // Try to abort job on error
      try {
        await this.abortJob(accessToken, instanceUrl, job.id);
      } catch {}
      throw error;
    }
  }

  async deleteRecords(
    environmentId: string,
    objectType: string,
    recordIds: string[],
  ): Promise<BulkResult[]> {
    if (recordIds.length === 0) {
      return [];
    }

    const accessToken = await this.authService.getAccessToken(environmentId);
    const instanceUrl = await this.authService.getInstanceUrl(environmentId);

    // Create bulk job
    const job = await this.createJob(accessToken, instanceUrl, objectType, 'delete');

    try {
      // Upload IDs
      const records = recordIds.map((id) => ({ Id: id }));
      await this.uploadData(accessToken, instanceUrl, job.id, records);

      // Close job and wait for completion
      await this.closeJob(accessToken, instanceUrl, job.id);
      await this.waitForJobCompletion(accessToken, instanceUrl, job.id);

      // Get results
      return this.getJobResults(accessToken, instanceUrl, job.id, recordIds.length);
    } catch (error) {
      try {
        await this.abortJob(accessToken, instanceUrl, job.id);
      } catch {}
      throw error;
    }
  }

  private async createJob(
    accessToken: string,
    instanceUrl: string,
    objectType: string,
    operation: 'insert' | 'update' | 'upsert' | 'delete',
  ): Promise<BulkJobInfo> {
    const url = `${instanceUrl}/services/data/${this.apiVersion}/jobs/ingest`;

    const response = await firstValueFrom(
      this.httpService.post<BulkJobInfo>(
        url,
        {
          object: objectType,
          operation,
          contentType: 'CSV',
          lineEnding: 'LF',
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    return response.data;
  }

  private async uploadData(
    accessToken: string,
    instanceUrl: string,
    jobId: string,
    records: Record<string, any>[],
  ): Promise<void> {
    const url = `${instanceUrl}/services/data/${this.apiVersion}/jobs/ingest/${jobId}/batches`;

    // Convert records to CSV
    const csv = this.recordsToCsv(records);

    await firstValueFrom(
      this.httpService.put(url, csv, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'text/csv',
        },
      }),
    );
  }

  private async closeJob(
    accessToken: string,
    instanceUrl: string,
    jobId: string,
  ): Promise<void> {
    const url = `${instanceUrl}/services/data/${this.apiVersion}/jobs/ingest/${jobId}`;

    await firstValueFrom(
      this.httpService.patch(
        url,
        { state: 'UploadComplete' },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      ),
    );
  }

  private async abortJob(
    accessToken: string,
    instanceUrl: string,
    jobId: string,
  ): Promise<void> {
    const url = `${instanceUrl}/services/data/${this.apiVersion}/jobs/ingest/${jobId}`;

    await firstValueFrom(
      this.httpService.patch(
        url,
        { state: 'Aborted' },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      ),
    );
  }

  private async getJobStatus(
    accessToken: string,
    instanceUrl: string,
    jobId: string,
  ): Promise<BulkJobInfo> {
    const url = `${instanceUrl}/services/data/${this.apiVersion}/jobs/ingest/${jobId}`;

    const response = await firstValueFrom(
      this.httpService.get<BulkJobInfo>(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }),
    );

    return response.data;
  }

  private async waitForJobCompletion(
    accessToken: string,
    instanceUrl: string,
    jobId: string,
    maxWaitTime = 300000, // 5 minutes
    pollInterval = 2000, // 2 seconds
  ): Promise<BulkJobInfo> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getJobStatus(accessToken, instanceUrl, jobId);

      if (status.state === 'JobComplete') {
        return status;
      }

      if (status.state === 'Failed' || status.state === 'Aborted') {
        throw new BadRequestException(`Bulk job ${status.state}`);
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new BadRequestException('Bulk job timed out');
  }

  private async getJobResults(
    accessToken: string,
    instanceUrl: string,
    jobId: string,
    recordCount: number,
  ): Promise<BulkResult[]> {
    const successUrl = `${instanceUrl}/services/data/${this.apiVersion}/jobs/ingest/${jobId}/successfulResults`;
    const failedUrl = `${instanceUrl}/services/data/${this.apiVersion}/jobs/ingest/${jobId}/failedResults`;

    const [successResponse, failedResponse] = await Promise.all([
      firstValueFrom(
        this.httpService.get(successUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'text/csv',
          },
        }),
      ),
      firstValueFrom(
        this.httpService.get(failedUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'text/csv',
          },
        }),
      ),
    ]);

    const successRecords = this.csvToRecords(successResponse.data);
    const failedRecords = this.csvToRecords(failedResponse.data);

    const results: BulkResult[] = [];

    for (const record of successRecords) {
      results.push({
        success: true,
        id: record.sf__Id,
        sf__Id: record.sf__Id,
        sf__Created: record.sf__Created === 'true',
      });
    }

    for (const record of failedRecords) {
      results.push({
        success: false,
        sf__Error: record.sf__Error,
        errors: [record.sf__Error],
      });
    }

    return results;
  }

  private recordsToCsv(records: Record<string, any>[]): string {
    if (records.length === 0) {
      return '';
    }

    // Get all unique keys
    const keys = [...new Set(records.flatMap((r) => Object.keys(r)))];

    // Create header row
    const header = keys.join(',');

    // Create data rows
    const rows = records.map((record) =>
      keys
        .map((key) => {
          const value = record[key];
          if (value === null || value === undefined) {
            return '';
          }
          // Escape quotes and wrap in quotes if needed
          const str = String(value);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(','),
    );

    return [header, ...rows].join('\n');
  }

  private csvToRecords(csv: string): Record<string, any>[] {
    if (!csv || csv.trim() === '') {
      return [];
    }

    const lines = csv.split('\n').filter((line) => line.trim());
    if (lines.length < 2) {
      return [];
    }

    const headers = this.parseCsvLine(lines[0]);
    const records: Record<string, any>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      const record: Record<string, any> = {};
      headers.forEach((header, index) => {
        record[header] = values[index] || '';
      });
      records.push(record);
    }

    return records;
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          result.push(current);
          current = '';
        } else {
          current += char;
        }
      }
    }

    result.push(current);
    return result;
  }
}
