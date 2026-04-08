import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { StripeModule } from '../stripe/stripe.module';
import { OrganizationModule } from '../organizations/organization.module';

@Module({
  imports: [StripeModule, OrganizationModule],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
