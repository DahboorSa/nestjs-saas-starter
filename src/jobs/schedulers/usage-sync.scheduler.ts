import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CacheService } from '../../cache/cache.service';
import { UsageRecordService } from '../../modules/usage-records/usage-record.service';
import { UsageMetric } from '../../enums';
import { UsageRecordEntity } from '../../modules/usage-records/entities/usage-record.entity';
import { OrganizationEntity } from '../../modules/organizations/entities/organization.entity';

@Injectable()
export class UsageSyncScheduler {
  private readonly logger = new Logger(UsageSyncScheduler.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly usageRecordService: UsageRecordService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    this.logger.debug('Running scheduled job for usage sync records');
    const keys = await this.cacheService.getByPattern(
      `usage:*:${UsageMetric.API_CALLS}:*`,
    );
    const usageRecords: Partial<UsageRecordEntity>[] = [];
    for (const key of keys) {
      const usage = await this.cacheService.get(key);
      if (!usage) continue;
      const organizationId = key.split(':')[1];
      const metric = key.split(':')[2];
      const period = key.split(':')[3];
      try {
        this.logger.log(
          `organizationId: ${organizationId}, metrics: ${metric}, period: ${period}, usage: ${usage}`,
        );
        if (!Object.values(UsageMetric).includes(metric as UsageMetric)) {
          this.logger.warn(
            `Unknown metric "${metric}" in key "${key}", skipping`,
          );
          continue;
        }
        usageRecords.push({
          metric: metric as UsageMetric,
          period,
          value: +usage,
          organization: { id: organizationId } as OrganizationEntity,
        });
      } catch (e) {
        this.logger.error(
          `error creating usage record for organizationId: ${organizationId}, metrics: ${metric}, period: ${period}, usage: ${usage}
          , error: ${e.message}`,
          e.message,
        );
      }
    }
    if (usageRecords.length > 0) {
      await this.usageRecordService.createMany(usageRecords);
    }
    this.logger.log('Finished running scheduled job for usage sync records');
  }
}
