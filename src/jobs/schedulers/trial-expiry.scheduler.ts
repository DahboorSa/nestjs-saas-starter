import { logError } from '../../common/utils/log-error.util';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IsNull, LessThan } from 'typeorm';
import { OrganizationService } from '../../modules/organizations/organization.service';
import { PaymentStatus } from '../../enums';

@Injectable()
export class TrialExpiryScheduler {
  private readonly logger = new Logger(TrialExpiryScheduler.name);

  constructor(private readonly organizationService: OrganizationService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    this.logger.log('Running trial expiry check');

    // Cancel before suspending so orgs suspended below don't also match the
    // grace-period query in the same run and skip their grace period.
    // Each phase is idempotent, so a failure is retried by the next run.
    await this.runPhase('Grace period expired', () => {
      const gracePeriodDeadline = new Date(
        Date.now() - 5 * 24 * 60 * 60 * 1000,
      );
      return this.organizationService.updateMany(
        {
          isActive: true,
          paymentStatus: PaymentStatus.SUSPENDED,
          trialEndsAt: LessThan(gracePeriodDeadline),
          stripeSubscriptionId: IsNull(),
        },
        { paymentStatus: PaymentStatus.CANCELLED, isActive: false },
      );
    });

    await this.runPhase('Trial expired', () =>
      this.organizationService.updateMany(
        {
          isActive: true,
          paymentStatus: PaymentStatus.TRIAL,
          trialEndsAt: LessThan(new Date()),
          stripeSubscriptionId: IsNull(),
        },
        { paymentStatus: PaymentStatus.SUSPENDED },
      ),
    );

    this.logger.log('Trial expiry check complete');
  }

  private async runPhase(label: string, run: () => Promise<number>) {
    try {
      const affected = await run();
      this.logger.warn(`${label} for ${affected} org(s)`);
    } catch (err) {
      logError(this.logger, `${label} update failed`, err);
    }
  }
}
