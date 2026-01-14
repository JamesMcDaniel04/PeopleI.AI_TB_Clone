import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  ParseBoolPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EnvironmentsService } from './environments.service';
import { SalesforceAuthService } from '../salesforce/services/salesforce-auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { CreateEnvironmentDto } from './dto/create-environment.dto';
import { UpdateEnvironmentDto } from './dto/update-environment.dto';
import { SalesforceCallbackDto } from './dto/salesforce-callback.dto';

@ApiTags('environments')
@Controller('environments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EnvironmentsController {
  constructor(
    private environmentsService: EnvironmentsService,
    private salesforceAuthService: SalesforceAuthService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all environments for current user' })
  @ApiResponse({ status: 200, description: 'Environments retrieved' })
  async findAll(@CurrentUser() user: User) {
    const environments = await this.environmentsService.findAll(user.id);
    return {
      success: true,
      data: environments,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get environment by ID' })
  @ApiResponse({ status: 200, description: 'Environment retrieved' })
  @ApiResponse({ status: 404, description: 'Environment not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    const environment = await this.environmentsService.findById(id, user.id);
    return {
      success: true,
      data: environment,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new environment' })
  @ApiResponse({ status: 201, description: 'Environment created' })
  async create(@Body() dto: CreateEnvironmentDto, @CurrentUser() user: User) {
    const environment = await this.environmentsService.create(user.id, dto);
    return {
      success: true,
      data: environment,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update environment' })
  @ApiResponse({ status: 200, description: 'Environment updated' })
  @ApiResponse({ status: 404, description: 'Environment not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEnvironmentDto,
    @CurrentUser() user: User,
  ) {
    const environment = await this.environmentsService.update(id, user.id, dto);
    return {
      success: true,
      data: environment,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete environment' })
  @ApiResponse({ status: 200, description: 'Environment deleted' })
  @ApiResponse({ status: 404, description: 'Environment not found' })
  async delete(@Param('id') id: string, @CurrentUser() user: User) {
    await this.environmentsService.delete(id, user.id);
    return {
      success: true,
      message: 'Environment deleted successfully',
    };
  }

  @Get(':id/auth-url')
  @ApiOperation({ summary: 'Get Salesforce OAuth authorization URL' })
  @ApiResponse({ status: 200, description: 'Authorization URL generated' })
  async getAuthUrl(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Query('isSandbox', new ParseBoolPipe({ optional: true })) isSandbox?: boolean,
  ) {
    // Verify ownership and resolve environment settings
    const environment = await this.environmentsService.findById(id, user.id);

    const authUrl = await this.salesforceAuthService.getAuthorizationUrl(
      id,
      user.id,
      isSandbox ?? environment.isSandbox,
    );
    return {
      success: true,
      data: { authUrl },
    };
  }

  @Post(':id/callback')
  @ApiOperation({ summary: 'Handle Salesforce OAuth callback' })
  @ApiResponse({ status: 200, description: 'Salesforce connected' })
  async handleCallback(
    @Param('id') id: string,
    @Body() dto: SalesforceCallbackDto,
    @CurrentUser() user: User,
  ) {
    // Verify ownership
    await this.environmentsService.findById(id, user.id);

    // Exchange code for tokens
    await this.salesforceAuthService.handleCallback(id, user.id, dto.code, dto.state);

    const environment = await this.environmentsService.findById(id, user.id);
    return {
      success: true,
      data: environment,
      message: 'Salesforce connected successfully',
    };
  }

  @Post(':id/disconnect')
  @ApiOperation({ summary: 'Disconnect Salesforce from environment' })
  @ApiResponse({ status: 200, description: 'Salesforce disconnected' })
  async disconnect(@Param('id') id: string, @CurrentUser() user: User) {
    await this.environmentsService.disconnect(id, user.id);
    return {
      success: true,
      message: 'Salesforce disconnected successfully',
    };
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Check Salesforce connection status' })
  @ApiResponse({ status: 200, description: 'Connection status retrieved' })
  async getStatus(@Param('id') id: string, @CurrentUser() user: User) {
    const environment = await this.environmentsService.findById(id, user.id);
    const isConnected = await this.salesforceAuthService.verifyConnection(id);

    return {
      success: true,
      data: {
        status: environment.status,
        isConnected,
        instanceUrl: environment.salesforceInstanceUrl,
        orgId: environment.salesforceOrgId,
        lastSyncedAt: environment.lastSyncedAt,
      },
    };
  }
}
