import type { StripeService } from './stripe.service';

// Stripe's resource types are not exported by the v22 entry point, so derive
// them from the service signatures.
export type StripeSubscription = Awaited<
  ReturnType<StripeService['retrieveSubscription']>
>;
export type StripePaymentMethod = Awaited<
  ReturnType<StripeService['listPaymentMethods']>
>['data'][number];

export type StripeEvent = ReturnType<StripeService['constructWebhookEvent']>;

// Narrowed per event type, so each handler gets its exact Stripe object.
export type StripeEventObject<T extends StripeEvent['type']> = Extract<
  StripeEvent,
  { type: T }
>['data']['object'];
