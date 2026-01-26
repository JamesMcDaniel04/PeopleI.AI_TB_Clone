import {
  IsString,
  IsOptional,
  IsUUID,
  IsObject,
  IsInt,
  Min,
  Max,
  ValidateNested,
  IsBoolean,
  IsDateString,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class RecordCountsDto {
  @ApiPropertyOptional({ example: 5, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  Account?: number;

  @ApiPropertyOptional({ example: 15, minimum: 0, maximum: 500 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  Contact?: number;

  @ApiPropertyOptional({ example: 10, minimum: 0, maximum: 200 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  Lead?: number;

  @ApiPropertyOptional({ example: 10, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  Opportunity?: number;

  @ApiPropertyOptional({ example: 5, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  Case?: number;

  @ApiPropertyOptional({ example: 3, minimum: 0, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  Campaign?: number;

  @ApiPropertyOptional({ example: 20, minimum: 0, maximum: 500 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  CampaignMember?: number;

  @ApiPropertyOptional({ example: 20, minimum: 0, maximum: 500 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  Task?: number;

  @ApiPropertyOptional({ example: 10, minimum: 0, maximum: 200 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  Event?: number;

  @ApiPropertyOptional({ example: 10, minimum: 0, maximum: 200 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  EmailMessage?: number;

  // Allow custom objects with dynamic keys
  [key: string]: number | undefined;
}

class TemporalRealismDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: '2024-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2024-03-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'bell-curve' })
  @IsOptional()
  @IsIn(['uniform', 'front-loaded', 'back-loaded', 'bell-curve'])
  pattern?: 'uniform' | 'front-loaded' | 'back-loaded' | 'bell-curve';
}

export class GenerateDataDto {
  @ApiProperty({ example: 'Q1 Demo Dataset' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Demo data for Q1 sales presentations' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Template ID to use for generation' })
  @IsUUID()
  templateId: string;

  @ApiPropertyOptional({ description: 'Environment ID for Salesforce injection' })
  @IsOptional()
  @IsUUID()
  environmentId?: string;

  @ApiProperty({ description: 'Number of records to generate per object type' })
  @ValidateNested()
  @Type(() => RecordCountsDto)
  recordCounts: RecordCountsDto;

  @ApiPropertyOptional({ example: 'Enterprise software sales to Fortune 500' })
  @IsOptional()
  @IsString()
  scenario?: string;

  @ApiPropertyOptional({ example: 'technology' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ description: 'Temporal realism for activity generation' })
  @IsOptional()
  @ValidateNested()
  @Type(() => TemporalRealismDto)
  temporalRealism?: TemporalRealismDto;
}
