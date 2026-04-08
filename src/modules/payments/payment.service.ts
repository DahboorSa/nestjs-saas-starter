import { Injectable } from '@nestjs/common';
import { StripeService } from '../stripe/stripe.service';
import { AuditContextDto } from '../../common/dto/audit-context.dto';
import { OrganizationService } from '../organizations/organization.service';
import { CreateSubscriptionDto } from './dto';
import { PaymentStatus } from '../../enums';

@Injectable()
export class PaymentService {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly stripeService: StripeService,
  ) {}

  async createSubscription(
    auditContext: AuditContextDto,
    body: CreateSubscriptionDto,
  ) {
    const { organizationId, organizationEmail } = auditContext;
    const { paymentMethodId } = body;
    const organizationDetails =
      await this.organizationService.getById(organizationId);
    let customerId = organizationDetails.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripeService.createCustomer(
        organizationDetails.name,
        organizationEmail,
        organizationId,
      );
      customerId = customer.id;
      await this.organizationService.updateFields(organizationId, {
        stripeCustomerId: customerId,
      });
    }
    await this.stripeService.attachPaymentMethod(paymentMethodId, customerId);
    const { stripePriceId } = organizationDetails.plan;
    const subscription = await this.stripeService.createSubscription(
      customerId,
      stripePriceId,
      paymentMethodId,
    );
    await this.organizationService.updateFields(organizationId, {
      stripeSubscriptionId: subscription.id,
      paymentStatus: PaymentStatus.ACTIVE,
    });
    return {
      message: 'Subscription created successfully',
      subscriptionId: subscription.id,
      status: subscription.status,
    };
  }

  async getSubscription(auditContext: AuditContextDto) {
    const { organizationId } = auditContext;
    const organizationDetails =
      await this.organizationService.getById(organizationId);
    const { stripeSubscriptionId, paymentStatus } = organizationDetails;
    if (!stripeSubscriptionId) {
      return { paymentStatus, subscription: null };
    }
    const subscription =
      await this.stripeService.retrieveSubscription(stripeSubscriptionId);
    const sub = subscription as any;
    return {
      paymentStatus,
      subscription: {
        id: sub.id,
        status: sub.status,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
    };
  }
}
