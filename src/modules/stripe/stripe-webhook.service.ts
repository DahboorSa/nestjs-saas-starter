import { Injectable, Logger } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { OrganizationService } from '../organizations/organization.service';
import { PaymentStatus } from '../../enums';

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly organizationService: OrganizationService,
  ) {}

  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    // constructWebhookEvent throws StripeSignatureVerificationError if invalid — let it propagate to controller
    const event = this.stripeService.constructWebhookEvent(payload, signature);

    try {
      switch (event.type) {
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as any);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as any);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as any);
          break;
        default:
          this.logger.log(`Unhandled Stripe event: ${event.type}`);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to process Stripe event ${event.type}: ${err?.message}`,
        err?.stack,
      );
      // Re-throw so controller returns 500 and Stripe retries
      throw error;
    }
  }

  private async handleSubscriptionUpdated(subscription: any): Promise<void> {
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

    const fields: any = { paymentStatus };
    if (paymentStatus === PaymentStatus.CANCELLED) {
      fields.isActive = false;
    }

    await this.organizationService.updateFields(org.id, fields);
    this.logger.log(
      `Org ${org.id} updated → ${paymentStatus} (Stripe: ${subscription.status})`,
    );
  }

  private async handleSubscriptionDeleted(subscription: any): Promise<void> {
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

  private async handleInvoicePaymentFailed(invoice: any): Promise<void> {
    if (!invoice.customer) {
      this.logger.warn(
        'invoice.payment_failed received with no customer ID — skipping',
      );
      return;
    }
    const org = await this.organizationService.getOneBy({
      stripeCustomerId: invoice.customer,
    });
    if (!org) {
      this.logger.warn(
        `No org found for customer ${invoice.customer} (invoice.payment_failed)`,
      );
      return;
    }
    await this.organizationService.updateFields(org.id, {
      paymentStatus: PaymentStatus.SUSPENDED,
    });
    this.logger.warn(`Org ${org.id} payment failed → SUSPENDED`);
  }
}
