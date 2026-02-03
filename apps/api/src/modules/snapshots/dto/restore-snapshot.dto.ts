import { IsOptional, IsBoolean, IsArray, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RestoreSnapshotDto {
  @ApiPropertyOptional({
    description: 'Delete existing records before restoring',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  deleteExisting?: boolean;

  @ApiPropertyOptional({
    description: 'Only restore specific object types',
    example: ['Account', 'Contact', 'Opportunity'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  objectTypes?: string[];

  @ApiPropertyOptional({
    description: 'Perform a dry run without actually restoring',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
