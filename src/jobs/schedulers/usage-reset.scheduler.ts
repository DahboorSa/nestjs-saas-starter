import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CacheService } from '../../cache/cache.service';
import { UsageMetric } from '../../enums';
import { InvitationService } from '../../modules/invitations/invitation.service';

@Injectable()
export class UsageResetScheduler {
  private readonly logger = new Logger(UsageResetScheduler.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly invitationService: InvitationService,
  ) {}

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async handleCron() {
    this.logger.log('Running monthly usage reset');
    await this.cacheService.deleteByPattern(
      `usage:*:${UsageMetric.API_CALLS}:*`,
    );
    await this.cacheService.deleteByPattern(`usage:*:limit_exceeded`);
    this.logger.log('Monthly usage reset complete');
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireInvitations() {
    this.logger.log('Running daily invitation expiration');
    await this.invitationService.expireInvitations();
    this.logger.log('Daily invitation expiration complete');
  }
}
