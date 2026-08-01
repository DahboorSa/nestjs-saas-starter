import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { PaymentMethodController } from './payment-method.controller';
import { InvoiceController } from './invoice.controller';
import { BillingService } from './billing.service';
import { StripeModule } from '../stripe/stripe.module';
import { OrganizationModule } from '../organizations/organization.module';

@Module({
  imports: [StripeModule, OrganizationModule],
  controllers: [
    SubscriptionController,
    PaymentMethodController,
    InvoiceController,
  ],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
