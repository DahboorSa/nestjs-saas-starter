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
    const expiredTrialOrgs = await this.organizationService.getAll({
      isActive: true,
      paymentStatus: PaymentStatus.TRIAL,
      trialEndsAt: LessThan(new Date()),
      stripeSubscriptionId: IsNull(),
    });

    for (const org of expiredTrialOrgs) {
      await this.organizationService.updateFields(org.id, {
        paymentStatus: PaymentStatus.SUSPENDED,
      });
      this.logger.warn('Trial expired for org', org.id);
    }
    const now = new Date();
    const gracePeriodDeadline = new Date(
      now.getTime() - 5 * 24 * 60 * 60 * 1000,
    );

    const cancelledOrgs = await this.organizationService.getAll({
      isActive: true,
      paymentStatus: PaymentStatus.SUSPENDED,
      trialEndsAt: LessThan(gracePeriodDeadline),
      stripeSubscriptionId: IsNull(),
    });

    for (const org of cancelledOrgs) {
      await this.organizationService.updateFields(org.id, {
        paymentStatus: PaymentStatus.CANCELLED,
        isActive: false,
      });
      this.logger.warn('Grace period expired for org', org.id);
    }

    this.logger.log('Trial expiry check complete');
  }
}
