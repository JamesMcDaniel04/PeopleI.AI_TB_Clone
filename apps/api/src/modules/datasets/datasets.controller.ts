import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  Query,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DatasetsService } from './datasets.service';
import { SalesforceService } from '../salesforce/salesforce.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('datasets')
@Controller('datasets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DatasetsController {
  constructor(
    private datasetsService: DatasetsService,
    private salesforceService: SalesforceService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all datasets for current user' })
  @ApiResponse({ status: 200, description: 'Datasets retrieved' })
  async findAll(@CurrentUser() user: User) {
    const datasets = await this.datasetsService.findAll(user.id);
    return {
      success: true,
      data: datasets,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get dataset by ID' })
  @ApiResponse({ status: 200, description: 'Dataset retrieved' })
  @ApiResponse({ status: 404, description: 'Dataset not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    const dataset = await this.datasetsService.findById(id);

    if (dataset.userId !== user.id) {
      return {
        success: false,
        error: 'Access denied',
      };
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
  async getRecords(
    @Param('id') id: string,
    @Query('objectType') objectType: string,
    @CurrentUser() user: User,
  ) {
    const dataset = await this.datasetsService.findById(id);

    if (dataset.userId !== user.id) {
      return {
        success: false,
        error: 'Access denied',
      };
    }

    const records = objectType
      ? await this.datasetsService.getRecordsByObject(id, objectType)
      : await this.datasetsService.getRecords(id);

    return {
      success: true,
      data: records,
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
  async cleanup(@Param('id') id: string, @CurrentUser() user: User) {
    const dataset = await this.datasetsService.findById(id);

    if (dataset.userId !== user.id) {
      return {
        success: false,
        error: 'Access denied',
      };
    }

    if (!dataset.environmentId) {
      return {
        success: false,
        error: 'No Salesforce environment linked to this dataset',
      };
    }

    const injectedRecords = await this.datasetsService.getInjectedRecords(id);

    if (injectedRecords.length === 0) {
      return {
        success: true,
        message: 'No records to clean up',
      };
    }

    const result = await this.salesforceService.cleanupRecords(
      dataset.environmentId,
      injectedRecords,
    );

    return {
      success: true,
      data: {
        deleted: result.success,
        failed: result.failed,
        message: `Cleaned up ${result.success} records, ${result.failed} failed`,
      },
    };
  }

  @Get(':id/export')
  @ApiOperation({ summary: 'Export dataset as JSON' })
  @ApiResponse({ status: 200, description: 'Dataset exported' })
  async export(@Param('id') id: string, @CurrentUser() user: User) {
    const dataset = await this.datasetsService.findById(id);

    if (dataset.userId !== user.id) {
      return {
        success: false,
        error: 'Access denied',
      };
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
