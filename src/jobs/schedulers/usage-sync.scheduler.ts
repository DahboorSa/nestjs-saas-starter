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
    this.logger.debug(
      `Found ${keys.length} usage keys: ${JSON.stringify(keys)}`,
    );
    for (const key of keys) {
      const usage = await this.cacheService.get(key);
      if (!usage) continue;
      const parts = key.split(':');
      const [, orgId, metric, period] = parts;
      this.logger.debug(
        `Processing key="${key}" parts=${JSON.stringify(parts)} orgId="${orgId}" metric="${metric}" period="${period}" value="${usage}"`,
      );
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
        this.logger.debug(`Successfully synced key="${key}"`);
      } catch (error) {
        if (
          error instanceof QueryFailedError &&
          (error as any).code === '23503'
        ) {
          this.logger.warn(
            `FK violation syncing key="${key}" orgId="${orgId}" — org may not exist in DB. Detail: ${(error as any).detail ?? (error as any).message}`,
          );
          await this.cacheService.delete(key);
        } else {
          this.logger.error(
            `Failed to sync usage for key="${key}" orgId="${orgId}" — code: ${(error as any).code} — ${(error as any).message}`,
            error,
          );
        }
      }
    }
    this.logger.log('Finished running scheduled job for usage sync records');
  }
}
