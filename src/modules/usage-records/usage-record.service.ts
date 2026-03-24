import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UsageRecordEntity } from './entities/usage-record.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UsageRecordService {
  constructor(
    @InjectRepository(UsageRecordEntity)
    private readonly usageRecordRepository: Repository<UsageRecordEntity>,
  ) {}

  async create(
    organizationId: string,
    usageRecord: Partial<UsageRecordEntity>,
  ): Promise<void> {
    await this.usageRecordRepository.upsert(
      {
        metric: usageRecord.metric,
        period: usageRecord.period,
        value: usageRecord.value,
        organization: { id: organizationId },
      },
      ['organizationId', 'metric', 'period'],
    );
  }

  async createMany(usageRecords: Partial<UsageRecordEntity>[]): Promise<void> {
    await this.usageRecordRepository.upsert(usageRecords, [
      'organizationId',
      'metric',
      'period',
    ]);
  }
}
