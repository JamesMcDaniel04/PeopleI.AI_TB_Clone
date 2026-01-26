import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SnapshotsService, CreateSnapshotDto, RestoreSnapshotOptions } from './snapshots.service';
import { SnapshotType } from './entities/snapshot.entity';

@ApiTags('snapshots')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('snapshots')
export class SnapshotsController {
  constructor(private readonly snapshotsService: SnapshotsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new snapshot' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSnapshotDto,
  ) {
    return this.snapshotsService.createSnapshot(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all snapshots' })
  @ApiQuery({ name: 'environmentId', required: false })
  @ApiQuery({ name: 'type', required: false, enum: SnapshotType })
  @ApiQuery({ name: 'isGoldenImage', required: false, type: Boolean })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('environmentId') environmentId?: string,
    @Query('type') type?: SnapshotType,
    @Query('isGoldenImage') isGoldenImage?: string,
  ) {
    return this.snapshotsService.findAll(userId, {
      environmentId,
      type,
      isGoldenImage: isGoldenImage === 'true' ? true : isGoldenImage === 'false' ? false : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a snapshot by ID' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.snapshotsService.findOne(id, userId);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore a snapshot to the environment' })
  async restore(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() options: RestoreSnapshotOptions,
  ) {
    return this.snapshotsService.restoreSnapshot(id, userId, options);
  }

  @Post(':id/set-golden-image')
  @ApiOperation({ summary: 'Set this snapshot as the golden image for its environment' })
  async setAsGoldenImage(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.snapshotsService.setAsGoldenImage(id, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a snapshot' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.snapshotsService.remove(id, userId);
    return { success: true };
  }

  @Get('environment/:environmentId/golden-image')
  @ApiOperation({ summary: 'Get the golden image for an environment' })
  async getGoldenImage(
    @CurrentUser('id') userId: string,
    @Param('environmentId', ParseUUIDPipe) environmentId: string,
  ) {
    return this.snapshotsService.getGoldenImage(environmentId, userId);
  }

  @Post('environment/:environmentId/reset-to-golden')
  @ApiOperation({ summary: 'Reset environment to its golden image state' })
  async resetToGoldenImage(
    @CurrentUser('id') userId: string,
    @Param('environmentId', ParseUUIDPipe) environmentId: string,
  ) {
    return this.snapshotsService.resetToGoldenImage(environmentId, userId);
  }
}
