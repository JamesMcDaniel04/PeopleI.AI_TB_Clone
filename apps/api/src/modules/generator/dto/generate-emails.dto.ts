import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateEmailsDto {
  @ApiPropertyOptional({
    description: 'Number of emails to generate in the thread',
    default: 3,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  emailCount?: number = 3;
}
