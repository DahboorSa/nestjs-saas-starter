import { Module } from '@nestjs/common';
import { UsageRecordService } from './usage-record.service';
import { UsageRecordEntity } from './entities/usage-record.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([UsageRecordEntity])],
  providers: [UsageRecordService],
  exports: [UsageRecordService],
})
export class UsageRecordModule {}
