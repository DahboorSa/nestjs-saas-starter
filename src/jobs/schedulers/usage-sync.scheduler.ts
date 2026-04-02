import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QueryFailedError } from 'typeorm';
import { CacheService } from '../../cache/cache.service';
import { UsageRecordService } from '../../modules/usage-records/usage-record.service';
import { UsageMetric } from '../../enums';

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
    for (const key of keys) {
      const usage = await this.cacheService.get(key);
      if (!usage) continue;
      const [, orgId, metric, period] = key.split(':');
      if (!Object.values(UsageMetric).includes(metric as UsageMetric)) {
        this.logger.warn(
          `Unknown metric "${metric}" in key "${key}", skipping`,
        );
        continue;
      }
      try {
        await this.usageRecordService.create(orgId, {
          metric: metric as UsageMetric,
          period,
          value: +usage,
        });
      } catch (error) {
        if (
          error instanceof QueryFailedError &&
          (error as any).code === '23503' // Foreign key violation, likely due to org being deleted -- this should not happen often, but if it does, we should clean up the cache key to prevent repeated errors on subsequent runs
        ) {
          this.logger.warn(`Deleting stale cache key for unknown org: ${key}`);
          await this.cacheService.delete(key);
        } else {
          this.logger.error(`Failed to sync usage for key: ${key}`, error);
        }
      }
    }
    this.logger.log('Finished running scheduled job for usage sync records');
  }
}
