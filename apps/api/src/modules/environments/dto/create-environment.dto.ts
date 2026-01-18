import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EnvironmentInjectionConfig } from '../entities/environment.entity';

export class CreateEnvironmentDto {
  @ApiProperty({ example: 'Production Org' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Main production Salesforce org' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isSandbox?: boolean;

  @ApiPropertyOptional({
    example: {
      recordTypeOverrides: { Opportunity: '012000000000000AAA' },
      fieldMappings: { Contact: { Title: 'Title__c' } },
      fieldDefaults: { Opportunity: { StageName: 'Prospecting' } },
    },
  })
  @IsOptional()
  @IsObject()
  injectionConfig?: EnvironmentInjectionConfig;
}
