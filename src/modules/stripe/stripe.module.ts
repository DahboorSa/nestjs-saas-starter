import { Module } from '@nestjs/common';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';
import { StripeCoreModule } from './stripe-core.module';
import { OrganizationModule } from '../organizations/organization.module';

@Module({
  imports: [StripeCoreModule, OrganizationModule],
  controllers: [StripeWebhookController],
  providers: [StripeWebhookService],
  exports: [StripeCoreModule],
})
export class StripeModule {}
