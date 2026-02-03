import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsBoolean,
  IsObject,
  IsArray,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SnapshotType } from '../entities/snapshot.entity';

export class CreateSnapshotDto {
  @ApiProperty({ description: 'Name of the snapshot', example: 'Pre-demo snapshot' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Description of the snapshot' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ description: 'Environment ID to snapshot' })
  @IsUUID()
  environmentId: string;

  @ApiPropertyOptional({
    description: 'Type of snapshot',
    enum: SnapshotType,
    default: SnapshotType.MANUAL,
  })
  @IsOptional()
  @IsEnum(SnapshotType)
  type?: SnapshotType;

  @ApiPropertyOptional({
    description: 'Whether this snapshot should be marked as a golden image',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isGoldenImage?: boolean;

  @ApiPropertyOptional({
    description: 'Specific record IDs to include (by object type)',
    example: { Account: ['001xxx', '001yyy'], Contact: ['003xxx'] },
  })
  @IsOptional()
  @IsObject()
  recordIds?: Record<string, string[]>;

  @ApiPropertyOptional({
    description: 'Tags for categorizing the snapshot',
    example: ['demo', 'q1-2024'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
