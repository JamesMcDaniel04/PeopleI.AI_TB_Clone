import { Controller, Get, Param, Query, UseGuards, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { JobStatus, JobType } from './entities/job.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('jobs')
@Controller('jobs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class JobsController {
  constructor(private jobsService: JobsService) {}

  @Get()
  @ApiOperation({ summary: 'List jobs for current user' })
  @ApiResponse({ status: 200, description: 'Jobs retrieved' })
  async list(
    @CurrentUser() user: User,
    @Query('datasetId') datasetId?: string,
    @Query('type') type?: JobType,
    @Query('status') status?: JobStatus,
    @Query('limit') limit?: string,
  ) {
    const jobs = await this.jobsService.findForUser(user.id, {
      datasetId,
      type,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return {
      success: true,
      data: jobs,
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
      throw new ForbiddenException('Access denied');
    }

    return {
      success: true,
      data: job,
    };
  }
}
