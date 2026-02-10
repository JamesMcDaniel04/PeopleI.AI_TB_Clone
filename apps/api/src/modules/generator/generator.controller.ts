import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GeneratorService } from './generator.service';
import { DatasetsService } from '../datasets/datasets.service';
import { QueueService } from '../jobs/services/queue.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { GenerateDataDto } from './dto/generate-data.dto';
import { GenerateEmailsDto } from './dto/generate-emails.dto';
import { GenerateCallDto } from './dto/generate-call.dto';
import { GenerateMeetingDto, MeetingType } from './dto/generate-meeting.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('generator')
@Controller('generate')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GeneratorController {
  constructor(
    private generatorService: GeneratorService,
    private datasetsService: DatasetsService,
    private queueService: QueueService,
  ) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 generations per minute
  @ApiOperation({ summary: 'Start data generation job' })
  @ApiResponse({ status: 201, description: 'Generation job started' })
  async startGeneration(
    @Body() dto: GenerateDataDto,
    @CurrentUser() user: User,
  ) {
    const dataset = await this.generatorService.startGeneration(user.id, dto);
    return {
      success: true,
      data: {
        datasetId: dataset.id,
        status: dataset.status,
        message: 'Generation job started. Check status for progress.',
      },
    };
  }

  @Get(':datasetId/status')
  @ApiOperation({ summary: 'Get generation job status' })
  @ApiResponse({ status: 200, description: 'Job status retrieved' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getStatus(
    @Param('datasetId') datasetId: string,
    @CurrentUser() user: User,
  ) {
    const dataset = await this.datasetsService.findById(datasetId);

    if (dataset.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }

    const recordCounts = await this.datasetsService.getRecordCounts(datasetId);

    return {
      success: true,
      data: {
        id: dataset.id,
        name: dataset.name,
        status: dataset.status,
        config: dataset.config,
        recordCounts,
        errorMessage: dataset.errorMessage,
        startedAt: dataset.startedAt,
        completedAt: dataset.completedAt,
        createdAt: dataset.createdAt,
      },
    };
  }

  @Post(':datasetId/inject')
  @ApiOperation({ summary: 'Inject generated data into Salesforce' })
  @ApiResponse({ status: 200, description: 'Injection job started' })
  @ApiResponse({ status: 400, description: 'No environment linked' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async injectData(
    @Param('datasetId') datasetId: string,
    @CurrentUser() user: User,
  ) {
    const dataset = await this.datasetsService.findById(datasetId);

    if (dataset.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }

    if (!dataset.environmentId) {
      throw new BadRequestException('No Salesforce environment linked to this dataset');
    }

    // Queue injection job
    await this.queueService.addInjectionJob({
      datasetId: dataset.id,
      environmentId: dataset.environmentId,
      userId: user.id,
    });

    return {
      success: true,
      data: {
        message: 'Injection job started. Check dataset status for progress.',
      },
    };
  }

  @Post(':datasetId/emails/:opportunityLocalId')
  @ApiOperation({ summary: 'Generate email thread for an opportunity' })
  @ApiResponse({ status: 200, description: 'Emails generated' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async generateEmails(
    @Param('datasetId') datasetId: string,
    @Param('opportunityLocalId') opportunityLocalId: string,
    @Body() dto: GenerateEmailsDto,
    @CurrentUser() user: User,
  ) {
    const dataset = await this.datasetsService.findById(datasetId);

    if (dataset.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }

    await this.generatorService.generateEmailsForOpportunity(
      datasetId,
      opportunityLocalId,
      dto.emailCount || 3,
    );

    return {
      success: true,
      message: 'Email thread generated successfully',
    };
  }

  @Post(':datasetId/calls/:opportunityLocalId')
  @ApiOperation({ summary: 'Generate call transcript for an opportunity' })
  @ApiResponse({ status: 200, description: 'Call transcript generated' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async generateCallTranscript(
    @Param('datasetId') datasetId: string,
    @Param('opportunityLocalId') opportunityLocalId: string,
    @Body() dto: GenerateCallDto,
    @CurrentUser() user: User,
  ) {
    const dataset = await this.datasetsService.findById(datasetId);

    if (dataset.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }

    await this.generatorService.generateCallTranscript(
      datasetId,
      opportunityLocalId,
      dto.callType || 'Discovery Call',
      dto.duration || 30,
    );

    return {
      success: true,
      message: 'Call transcript generated successfully',
    };
  }

  @Post(':datasetId/meetings/:opportunityLocalId')
  @ApiOperation({ summary: 'Generate meeting transcript for an opportunity' })
  @ApiResponse({ status: 200, description: 'Meeting transcript generated' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async generateMeetingTranscript(
    @Param('datasetId') datasetId: string,
    @Param('opportunityLocalId') opportunityLocalId: string,
    @Body() dto: GenerateMeetingDto,
    @CurrentUser() user: User,
  ) {
    const dataset = await this.datasetsService.findById(datasetId);

    if (dataset.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }

    await this.generatorService.generateMeetingTranscript(
      datasetId,
      opportunityLocalId,
      dto.meetingType || MeetingType.DEMO,
      dto.duration || 45,
    );

    return {
      success: true,
      message: 'Meeting transcript generated successfully',
    };
  }
}
