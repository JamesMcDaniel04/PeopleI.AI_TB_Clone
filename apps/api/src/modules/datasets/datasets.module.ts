import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatasetsController } from './datasets.controller';
import { DatasetsService } from './datasets.service';
import { Dataset } from './entities/dataset.entity';
import { DatasetRecord } from './entities/dataset-record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Dataset, DatasetRecord])],
  controllers: [DatasetsController],
  providers: [DatasetsService],
  exports: [DatasetsService],
})
export class DatasetsModule {}
