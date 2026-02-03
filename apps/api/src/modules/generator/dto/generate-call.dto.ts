import { IsOptional, IsString, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateCallDto {
  @ApiPropertyOptional({
    description: 'Type of call (e.g., Discovery Call, Sales Call, Support Call)',
    default: 'Discovery Call',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  callType?: string = 'Discovery Call';

  @ApiPropertyOptional({
    description: 'Duration of the call in minutes',
    default: 30,
    minimum: 5,
    maximum: 180,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(180)
  duration?: number = 30;
}
