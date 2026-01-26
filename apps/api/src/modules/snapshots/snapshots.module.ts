import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Snapshot } from './entities/snapshot.entity';
import { SnapshotsService } from './snapshots.service';
import { SnapshotsController } from './snapshots.controller';
import { SalesforceModule } from '../salesforce/salesforce.module';
import { EnvironmentsModule } from '../environments/environments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Snapshot]),
    SalesforceModule,
    EnvironmentsModule,
  ],
  controllers: [SnapshotsController],
  providers: [SnapshotsService],
  exports: [SnapshotsService],
})
export class SnapshotsModule {}
