import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { SalesforceController } from './salesforce.controller';
import { SalesforceService } from './salesforce.service';
import { SalesforceAuthService } from './services/salesforce-auth.service';
import { SalesforceRestApiService } from './services/salesforce-rest-api.service';
import { SalesforceBulkApiService } from './services/salesforce-bulk-api.service';
import { SalesforceObjectMapperService } from './services/salesforce-object-mapper.service';
import { EncryptionService } from './services/encryption.service';
import { Environment } from '../environments/entities/environment.entity';
import { SalesforceCredential } from '../environments/entities/salesforce-credential.entity';
import { SalesforceOAuthState } from './entities/salesforce-oauth-state.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Environment, SalesforceCredential, SalesforceOAuthState]),
    HttpModule,
  ],
  controllers: [SalesforceController],
  providers: [
    SalesforceService,
    SalesforceAuthService,
    SalesforceRestApiService,
    SalesforceBulkApiService,
    SalesforceObjectMapperService,
    EncryptionService,
  ],
  exports: [
    SalesforceService,
    SalesforceAuthService,
    SalesforceRestApiService,
    SalesforceBulkApiService,
    SalesforceObjectMapperService,
    EncryptionService,
  ],
})
export class SalesforceModule {}
