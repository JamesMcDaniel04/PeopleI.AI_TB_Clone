import { IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum MeetingType {
  DISCOVERY = 'discovery',
  DEMO = 'demo',
  NEGOTIATION = 'negotiation',
  KICKOFF = 'kickoff',
  QBR = 'qbr',
  TECHNICAL = 'technical',
  EXECUTIVE = 'executive',
}

export class GenerateMeetingDto {
  @ApiPropertyOptional({
    description: 'Type of meeting',
    enum: MeetingType,
    default: MeetingType.DEMO,
  })
  @IsOptional()
  @IsEnum(MeetingType)
  meetingType?: MeetingType = MeetingType.DEMO;

  @ApiPropertyOptional({
    description: 'Duration of the meeting in minutes',
    default: 45,
    minimum: 15,
    maximum: 240,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(240)
  duration?: number = 45;
}
