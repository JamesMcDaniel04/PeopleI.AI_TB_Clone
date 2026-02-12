import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  ForbiddenException,
  Post,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { JobStatus, JobType } from './entities/job.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { QueueService } from './services/queue.service';
import { DatasetsService } from '../datasets/datasets.service';
import { DatasetStatus } from '../datasets/entities/dataset.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('jobs')
@Controller('jobs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class JobsController {
  constructor(
    private jobsService: JobsService,
    private queueService: QueueService,
    private datasetsService: DatasetsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List jobs for current user' })
  @ApiResponse({ status: 200, description: 'Jobs retrieved' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'datasetId', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, enum: JobType })
  @ApiQuery({ name: 'status', required: false, enum: JobStatus })
  async list(
    @CurrentUser() user: User,
    @Query() pagination: PaginationDto,
    @Query('datasetId') datasetId?: string,
    @Query('type') type?: JobType,
    @Query('status') status?: JobStatus,
  ) {
    const result = await this.jobsService.findForUserPaginated(user.id, pagination, {
      datasetId,
      type,
      status,
    });

    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Get('admin/all')
  @ApiOperation({ summary: 'Admin list of all jobs' })
  @ApiResponse({ status: 200, description: 'Jobs retrieved' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'datasetId', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, enum: JobType })
  @ApiQuery({ name: 'status', required: false, enum: JobStatus })
  async listAll(
    @CurrentUser() user: User,
    @Query() pagination: PaginationDto,
    @Query('datasetId') datasetId?: string,
    @Query('userId') userId?: string,
    @Query('type') type?: JobType,
    @Query('status') status?: JobStatus,
  ) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }

    const result = await this.jobsService.findAllPaginated(pagination, {
      datasetId,
      userId,
      type,
      status,
    });

    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Get('admin/metrics')
  @ApiOperation({ summary: 'Admin queue metrics' })
  @ApiResponse({ status: 200, description: 'Queue metrics retrieved' })
  async metrics(@CurrentUser() user: User) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }

    const metrics = await this.queueService.getQueueMetrics();
    return {
      success: true,
      data: metrics,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get job by ID' })
  @ApiResponse({ status: 200, description: 'Job retrieved' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async get(@Param('id') id: string, @CurrentUser() user: User) {
    const job = await this.jobsService.findById(id);
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.userId !== user.id) {
      if (user.role !== 'admin') {
        throw new ForbiddenException('Access denied');
      }
    }

    return {
      success: true,
      data: job,
    };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a pending or active job' })
  @ApiResponse({ status: 200, description: 'Job cancelled' })
  async cancel(@Param('id') id: string, @CurrentUser() user: User) {
    const job = await this.jobsService.findById(id);
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.userId !== user.id) {
      if (user.role !== 'admin') {
        throw new ForbiddenException('Access denied');
      }
    }

    if (!job.queueName || !job.queueJobId) {
      throw new BadRequestException('Job is missing queue metadata');
    }

    if ([JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED].includes(job.status)) {
      return {
        success: true,
        data: {
          id: job.id,
          status: job.status,
          message: `Job is already ${job.status}`,
        },
      };
    }

    await this.queueService.cancelJob(job.queueName, job.queueJobId);
    await this.jobsService.markCancelled(job.queueName, job.queueJobId, 'Cancelled by user');

    if (job.datasetId) {
      const dataset = await this.datasetsService.findById(job.datasetId);
      if (
        job.type === JobType.DATA_GENERATION &&
        [DatasetStatus.PENDING, DatasetStatus.GENERATING].includes(dataset.status)
      ) {
        await this.datasetsService.updateStatus(
          job.datasetId,
          DatasetStatus.FAILED,
          'Generation cancelled by user',
        );
      }

      if (job.type === JobType.DATA_INJECTION && dataset.status === DatasetStatus.INJECTING) {
        await this.datasetsService.updateStatus(
          job.datasetId,
          DatasetStatus.FAILED,
          'Injection cancelled by user',
        );
      }
    }

    return {
      success: true,
      data: {
        id: job.id,
        status: JobStatus.CANCELLED,
        message: 'Job cancelled',
      },
    };
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry a failed or cancelled job' })
  @ApiResponse({ status: 200, description: 'Job retried' })
  async retry(@Param('id') id: string, @CurrentUser() user: User) {
    const job = await this.jobsService.findById(id);
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.userId !== user.id) {
      if (user.role !== 'admin') {
        throw new ForbiddenException('Access denied');
      }
    }

    if (![JobStatus.FAILED, JobStatus.CANCELLED].includes(job.status)) {
      throw new BadRequestException('Only failed or cancelled jobs can be retried');
    }

    if (!job.payload) {
      throw new BadRequestException('Job payload missing');
    }

    let newJobId: string | number | undefined;
    switch (job.type) {
      case JobType.DATA_GENERATION: {
        const newJob = await this.queueService.addGenerationJob(job.payload as any);
        newJobId = newJob.id;
        break;
      }
      case JobType.DATA_INJECTION: {
        const newJob = await this.queueService.addInjectionJob(job.payload as any);
        newJobId = newJob.id;
        break;
      }
      case JobType.CLEANUP: {
        const newJob = await this.queueService.addCleanupJob(job.payload as any);
        newJobId = newJob.id;
        break;
      }
      default:
        throw new BadRequestException('Unsupported job type for retry');
    }

    return {
      success: true,
      data: {
        originalJobId: job.id,
        jobId: String(newJobId),
        message: 'Retry job queued',
      },
    };
  }
}
