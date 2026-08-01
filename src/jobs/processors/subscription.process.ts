import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingService } from '../../modules/billing/billing.service';

@Injectable()
@Processor('subscriptionQueue')
export class SubscriptionProcessor extends WorkerHost {
  private readonly logger = new Logger(SubscriptionProcessor.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly billingService: BillingService,
  ) {
    super();
  }

  async process(job: Job<any>) {
    try {
      const { data } = job;
      const { userId, email, orgId } = data;
      this.logger.log(
        `Processing job ${job.id} of type ${job.name} for user ${userId}`,
      );
      switch (job.name) {
        case 'subscription.create':
          await this.billingService.createSubscription({
            organizationId: orgId,
            email,
          });
          this.logger.log('create subscription successfully', {
            userId,
            orgId,
          });
          break;
        default:
          this.logger.warn(`Unexpected job type: ${job.name}`);
          break;
      }
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }
}
