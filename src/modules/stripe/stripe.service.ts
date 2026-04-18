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
    paymentMethodId: string,
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
}
