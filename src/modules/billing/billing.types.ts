import type { StripeSubscription } from '../stripe/stripe.types';
import { PaymentStatus } from '../../enums';

// Stripe API < 2025-03-31 also returned the period on the subscription itself.
export type SubscriptionWithLegacyPeriod = StripeSubscription & {
  current_period_end?: number;
};

export interface PaymentMethodSummary {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
}

export interface SubscriptionSummary {
  id: string;
  status: string;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

export interface SubscriptionResponse {
  paymentStatus: PaymentStatus;
  subscription: SubscriptionSummary | null;
  paymentMethods: (PaymentMethodSummary & { isDefault?: boolean })[];
}
