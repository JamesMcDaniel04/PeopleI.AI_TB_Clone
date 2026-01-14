import {
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SalesforceObject } from '../entities/template-prompt.entity';

export class TemplatePromptInputDto {
  @ApiProperty({ enum: SalesforceObject })
  @IsEnum(SalesforceObject)
  salesforceObject: SalesforceObject;

  @ApiProperty({ description: 'System prompt for the object type' })
  @IsString()
  systemPrompt: string;

  @ApiProperty({ description: 'User prompt template supporting placeholders' })
  @IsString()
  userPromptTemplate: string;

  @ApiPropertyOptional({ description: 'Optional JSON schema for structured outputs' })
  @IsOptional()
  @IsObject()
  outputSchema?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Temperature for generation', default: 0.7 })
  @IsOptional()
  @IsNumber()
  temperature?: number;
}

export class UpsertTemplatePromptsDto {
  @ApiProperty({ type: [TemplatePromptInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplatePromptInputDto)
  prompts: TemplatePromptInputDto[];
}
