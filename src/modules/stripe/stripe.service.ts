import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripe: ReturnType<typeof Stripe>;

  constructor(private readonly configService: ConfigService) {
    this.stripe = Stripe(this.configService.get<string>('STRIPE_SECRET_KEY'));
  }

  retrieveCustomer(customerId: string) {
    return this.stripe.customers.retrieve(customerId);
  }

  createCustomer(name: string, email: string, orgId: string) {
    return this.stripe.customers.create({
      name,
      email,
      metadata: { orgId },
    });
  }

  attachPaymentMethod(paymentMethodId: string, customerId: string) {
    return this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
  }

  createSubscription(
    customerId: string,
    priceId: string,
    paymentMethodId?: string | undefined,
    trialEnd?: Date,
  ) {
    return this.stripe.subscriptions.create(
      {
        customer: customerId,
        items: [{ price: priceId }],
        default_payment_method: paymentMethodId,
        payment_behavior: 'error_if_incomplete',
        ...(trialEnd && { trial_end: Math.floor(trialEnd.getTime() / 1000) }),
      },
      {
        idempotencyKey: `sub_${customerId}_${priceId}`,
      },
    );
  }

  retrieveSubscription(subscriptionId: string) {
    return this.stripe.subscriptions.retrieve(subscriptionId);
  }

  async updateSubscription(subscriptionId: string, priceId: string) {
    const subscription = await this.retrieveSubscription(subscriptionId);
    const subscriptionItemId = subscription.items.data[0]?.id;
    if (!subscriptionItemId) {
      throw new Error('Subscription item not found');
    }
    return this.stripe.subscriptions.update(subscriptionId, {
      items: [{ id: subscriptionItemId, price: priceId }],
      proration_behavior: 'create_prorations',
      // Switching plans ends any active trial immediately and starts billing now.
      ...(subscription.status === 'trialing' && { trial_end: 'now' }),
    });
  }

  cancelSubscription(subscriptionId: string) {
    return this.stripe.subscriptions.cancel(subscriptionId);
  }

  constructWebhookEvent(payload: Buffer, signature: string) {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      this.configService.get<string>('STRIPE_WEBHOOK_SECRET'),
    );
  }
  listPaymentMethods(customerId: string) {
    return this.stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
  }

  listOfInvoices(customerId: string) {
    return this.stripe.invoices.list({
      customer: customerId,
    });
  }
}
