import {
  Controller,
  Get,
  Param,
  UseGuards,
  Post,
  Patch,
  Body,
  ForbiddenException,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TemplatesService } from './templates.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { UpsertTemplatePromptsDto } from './dto/upsert-template-prompts.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('templates')
@Controller('templates')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TemplatesController {
  constructor(private templatesService: TemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List all available templates' })
  @ApiResponse({ status: 200, description: 'Templates retrieved' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(@CurrentUser() user: User, @Query() pagination: PaginationDto) {
    const result = await this.templatesService.findAllPaginated(user.id, pagination);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get template by ID' })
  @ApiResponse({ status: 200, description: 'Template retrieved' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async findOne(@Param('id') id: string) {
    const template = await this.templatesService.findById(id);
    return {
      success: true,
      data: template,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new template' })
  @ApiResponse({ status: 201, description: 'Template created' })
  async create(@Body() dto: CreateTemplateDto, @CurrentUser() user: User) {
    const isSystem = dto.isSystem && user.role === UserRole.ADMIN;

    const template = await this.templatesService.create({
      name: dto.name,
      description: dto.description,
      category: dto.category,
      industry: dto.industry,
      config: dto.config,
      isSystem,
      userId: isSystem ? null : user.id,
    });

    return {
      success: true,
      data: template,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update template metadata' })
  @ApiResponse({ status: 200, description: 'Template updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @CurrentUser() user: User,
  ) {
    const template = await this.templatesService.findById(id);

    if (template.isSystem && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can edit system templates');
    }

    if (!template.isSystem && template.userId && template.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }

    if (user.role !== UserRole.ADMIN) {
      delete (dto as any).isSystem;
    }

    const updated = await this.templatesService.update(id, dto);
    return {
      success: true,
      data: updated,
    };
  }

  @Put(':id/prompts')
  @ApiOperation({ summary: 'Upsert template prompts' })
  @ApiResponse({ status: 200, description: 'Template prompts updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async upsertPrompts(
    @Param('id') id: string,
    @Body() dto: UpsertTemplatePromptsDto,
    @CurrentUser() user: User,
  ) {
    const template = await this.templatesService.findById(id);

    if (template.isSystem && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can edit system templates');
    }

    if (!template.isSystem && template.userId && template.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }

    const prompts = await this.templatesService.upsertPrompts(id, dto.prompts);
    return {
      success: true,
      data: prompts,
    };
  }
}
