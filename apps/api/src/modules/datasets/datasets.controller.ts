import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  Query,
  Post,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DatasetsService } from './datasets.service';
import { QueueService } from '../jobs/services/queue.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('datasets')
@Controller('datasets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DatasetsController {
  constructor(
    private datasetsService: DatasetsService,
    private queueService: QueueService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all datasets for current user' })
  @ApiResponse({ status: 200, description: 'Datasets retrieved' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(@CurrentUser() user: User, @Query() pagination: PaginationDto) {
    const result = await this.datasetsService.findAllPaginated(user.id, pagination);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get dataset by ID' })
  @ApiResponse({ status: 200, description: 'Dataset retrieved' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Dataset not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    const dataset = await this.datasetsService.findById(id);

    if (dataset.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }

    const recordCounts = await this.datasetsService.getRecordCounts(id);

    return {
      success: true,
      data: {
        ...dataset,
        recordCounts,
      },
    };
  }

  @Get(':id/records')
  @ApiOperation({ summary: 'Get dataset records' })
  @ApiResponse({ status: 200, description: 'Records retrieved' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiQuery({ name: 'objectType', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getRecords(
    @Param('id') id: string,
    @Query('objectType') objectType: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: User,
  ) {
    const dataset = await this.datasetsService.findById(id);

    if (dataset.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }

    const result = await this.datasetsService.getRecordsPaginated(id, objectType, pagination);

    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete dataset' })
  @ApiResponse({ status: 200, description: 'Dataset deleted' })
  @ApiResponse({ status: 404, description: 'Dataset not found' })
  async delete(@Param('id') id: string, @CurrentUser() user: User) {
    await this.datasetsService.delete(id, user.id);
    return {
      success: true,
      message: 'Dataset deleted successfully',
    };
  }

  @Post(':id/cleanup')
  @ApiOperation({ summary: 'Remove injected records from Salesforce' })
  @ApiResponse({ status: 200, description: 'Cleanup completed' })
  @ApiResponse({ status: 400, description: 'No environment linked' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async cleanup(@Param('id') id: string, @CurrentUser() user: User) {
    const dataset = await this.datasetsService.findById(id);

    if (dataset.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }

    if (!dataset.environmentId) {
      throw new BadRequestException('No Salesforce environment linked to this dataset');
    }

    const injectedRecords = await this.datasetsService.getInjectedRecords(id);

    if (injectedRecords.length === 0) {
      return {
        success: true,
        message: 'No records to clean up',
      };
    }

    const job = await this.queueService.addCleanupJob({
      datasetId: dataset.id,
      environmentId: dataset.environmentId,
      userId: user.id,
    });

    return {
      success: true,
      data: {
        jobId: String(job.id),
        message: 'Cleanup job queued. Check job status for progress.',
      },
    };
  }

  @Get(':id/export')
  @ApiOperation({ summary: 'Export dataset as JSON' })
  @ApiResponse({ status: 200, description: 'Dataset exported' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async export(@Param('id') id: string, @CurrentUser() user: User) {
    const dataset = await this.datasetsService.findById(id);

    if (dataset.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }

    const records = await this.datasetsService.getRecords(id);

    // Group records by object type
    const groupedRecords: Record<string, any[]> = {};
    for (const record of records) {
      if (!groupedRecords[record.salesforceObject]) {
        groupedRecords[record.salesforceObject] = [];
      }
      groupedRecords[record.salesforceObject].push(record.data);
    }

    return {
      success: true,
      data: {
        name: dataset.name,
        template: dataset.template?.name,
        config: dataset.config,
        createdAt: dataset.createdAt,
        records: groupedRecords,
      },
    };
  }
}
