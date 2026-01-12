import { Controller, Get, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SalesforceRestApiService } from './services/salesforce-rest-api.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EnvironmentsService } from '../environments/environments.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('salesforce')
@Controller('salesforce')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SalesforceController {
  constructor(
    private restApiService: SalesforceRestApiService,
    private environmentsService: EnvironmentsService,
  ) {}

  @Get(':environmentId/describe/:objectType')
  @ApiOperation({ summary: 'Describe Salesforce object schema' })
  @ApiResponse({ status: 200, description: 'Object schema retrieved' })
  async describeObject(
    @Param('environmentId') environmentId: string,
    @Param('objectType') objectType: string,
    @CurrentUser() user: User,
  ) {
    // Verify ownership
    await this.environmentsService.findById(environmentId, user.id);

    const schema = await this.restApiService.describeObject(environmentId, objectType);
    return {
      success: true,
      data: schema,
    };
  }

  @Get(':environmentId/query')
  @ApiOperation({ summary: 'Execute SOQL query' })
  @ApiResponse({ status: 200, description: 'Query results retrieved' })
  async query(
    @Param('environmentId') environmentId: string,
    @Query('q') soql: string,
    @CurrentUser() user: User,
  ) {
    // Verify ownership
    await this.environmentsService.findById(environmentId, user.id);

    const records = await this.restApiService.query(environmentId, soql);
    return {
      success: true,
      data: {
        records,
        totalSize: records.length,
      },
    };
  }

  @Get(':environmentId/records/:objectType/:recordId')
  @ApiOperation({ summary: 'Get Salesforce record by ID' })
  @ApiResponse({ status: 200, description: 'Record retrieved' })
  async getRecord(
    @Param('environmentId') environmentId: string,
    @Param('objectType') objectType: string,
    @Param('recordId') recordId: string,
    @CurrentUser() user: User,
  ) {
    // Verify ownership
    await this.environmentsService.findById(environmentId, user.id);

    const record = await this.restApiService.getRecord(environmentId, objectType, recordId);
    return {
      success: true,
      data: record,
    };
  }
}
