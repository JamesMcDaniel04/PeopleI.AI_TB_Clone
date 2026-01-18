import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobsService } from './jobs.service';

@Injectable()
export class JobsCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsCleanupService.name);
  private intervalId?: NodeJS.Timeout;

  constructor(
    private jobsService: JobsService,
    private configService: ConfigService,
  ) {}

  onModuleInit() {
    const intervalMinutes =
      this.configService.get<number>('jobs.cleanupIntervalMinutes') || 60;
    const retentionDays = this.configService.get<number>('jobs.retentionDays') || 30;

    this.logger.log(
      `Job cleanup scheduled every ${intervalMinutes} minutes (retention ${retentionDays} days).`,
    );

    this.intervalId = setInterval(() => {
      void this.runCleanup();
    }, intervalMinutes * 60 * 1000);

    void this.runCleanup();
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private async runCleanup() {
    const retentionDays = this.configService.get<number>('jobs.retentionDays') || 30;
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    try {
      const deleted = await this.jobsService.deleteOlderThan(cutoff);
      if (deleted > 0) {
        this.logger.log(`Deleted ${deleted} old job records.`);
      }
    } catch (error: any) {
      this.logger.warn(`Job cleanup failed: ${error.message}`);
    }
  }
}
