import { IsString, IsOptional, IsEnum, IsObject, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TemplateCategory, Industry } from '../entities/template.entity';

export class CreateTemplateDto {
  @ApiProperty({ example: 'Technology Sales' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Template for SaaS sales demos' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TemplateCategory, default: TemplateCategory.SALES_SCENARIO })
  @IsOptional()
  @IsEnum(TemplateCategory)
  category?: TemplateCategory;

  @ApiPropertyOptional({ enum: Industry, default: Industry.GENERAL })
  @IsOptional()
  @IsEnum(Industry)
  industry?: Industry;

  @ApiPropertyOptional({
    description: 'Template configuration: default record counts and scenario list',
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Admin-only flag to mark as system template' })
  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;
}
