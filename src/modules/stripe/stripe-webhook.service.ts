import { logError } from '../../common/utils/log-error.util';
import { Injectable, Logger } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { OrganizationService } from '../organizations/organization.service';
import { PaymentStatus } from '../../enums';
import { StripeEventObject } from './stripe.types';

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly organizationService: OrganizationService,
  ) {}

  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    // Throws on an invalid signature; the controller turns that into a 400
    const event = this.stripeService.constructWebhookEvent(payload, signature);

    try {
      switch (event.type) {
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object);
          break;
        default:
          this.logger.log(`Unhandled Stripe event: ${event.type}`);
      }
    } catch (error) {
      logError(
        this.logger,
        `Failed to process Stripe event ${event.type}`,
        error,
      );
      // Re-throw so controller returns 500 and Stripe retries
      throw error;
    }
  }

  private async handleSubscriptionUpdated(
    subscription: StripeEventObject<'customer.subscription.updated'>,
  ): Promise<void> {
    const org = await this.organizationService.getOneBy({
      stripeSubscriptionId: subscription.id,
    });
    if (!org) {
      this.logger.warn(
        `No org found for subscription ${subscription.id} (subscription.updated)`,
      );
      return;
    }

    let paymentStatus: PaymentStatus;
    switch (subscription.status) {
      case 'active':
        paymentStatus = PaymentStatus.ACTIVE;
        break;
      case 'trialing':
        paymentStatus = PaymentStatus.TRIAL;
        break;
      case 'past_due':
      case 'unpaid':
        paymentStatus = PaymentStatus.SUSPENDED;
        break;
      case 'canceled':
        paymentStatus = PaymentStatus.CANCELLED;
        break;
      default:
        this.logger.warn(`Unknown subscription status: ${subscription.status}`);
        return;
    }

    const fields: Parameters<OrganizationService['updateFields']>[1] = {
      paymentStatus,
    };
    if (paymentStatus === PaymentStatus.CANCELLED) {
      fields.isActive = false;
    }

    await this.organizationService.updateFields(org.id, fields);
    this.logger.log(
      `Org ${org.id} updated → ${paymentStatus} (Stripe: ${subscription.status})`,
    );
  }

  private async handleSubscriptionDeleted(
    subscription: StripeEventObject<'customer.subscription.deleted'>,
  ): Promise<void> {
    const org = await this.organizationService.getOneBy({
      stripeSubscriptionId: subscription.id,
    });
    if (!org) {
      this.logger.warn(
        `No org found for subscription ${subscription.id} (subscription.deleted)`,
      );
      return;
    }
    await this.organizationService.updateFields(org.id, {
      paymentStatus: PaymentStatus.CANCELLED,
      isActive: false,
    });
    this.logger.warn(`Org ${org.id} subscription deleted → CANCELLED`);
  }

  private async handleInvoicePaymentFailed(
    invoice: StripeEventObject<'invoice.payment_failed'>,
  ): Promise<void> {
    const customerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;
    if (!customerId) {
      this.logger.warn(
        'invoice.payment_failed received with no customer ID — skipping',
      );
      return;
    }
    const org = await this.organizationService.getOneBy({
      stripeCustomerId: customerId,
    });
    if (!org) {
      this.logger.warn(
        `No org found for customer ${customerId} (invoice.payment_failed)`,
      );
      return;
    }
    await this.organizationService.updateFields(org.id, {
      paymentStatus: PaymentStatus.SUSPENDED,
    });
    this.logger.warn(`Org ${org.id} payment failed → SUSPENDED`);
  }
}
