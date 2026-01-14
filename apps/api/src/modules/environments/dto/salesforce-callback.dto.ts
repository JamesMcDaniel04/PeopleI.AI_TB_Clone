import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SalesforceCallbackDto {
  @ApiProperty({ description: 'OAuth authorization code from Salesforce' })
  @IsString()
  code: string;

  @ApiProperty({ description: 'OAuth state token from Salesforce' })
  @IsString()
  state: string;

  @ApiPropertyOptional({ description: 'Whether this is a sandbox org', default: false })
  @IsOptional()
  @IsBoolean()
  isSandbox?: boolean;
}
