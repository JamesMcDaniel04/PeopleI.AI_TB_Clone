import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvironmentsController } from './environments.controller';
import { EnvironmentsService } from './environments.service';
import { Environment } from './entities/environment.entity';
import { SalesforceCredential } from './entities/salesforce-credential.entity';
import { SalesforceModule } from '../salesforce/salesforce.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Environment, SalesforceCredential]),
    SalesforceModule,
  ],
  controllers: [EnvironmentsController],
  providers: [EnvironmentsService],
  exports: [EnvironmentsService],
})
export class EnvironmentsModule {}
