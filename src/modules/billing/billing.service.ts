import { Injectable } from '@nestjs/common';
import { StripeService } from '../stripe/stripe.service';
import { AuditContextDto } from '../../common/dto/audit-context.dto';
import { OrganizationService } from '../organizations/organization.service';
import { PaymentStatus } from '../../enums';

@Injectable()
export class BillingService {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly stripeService: StripeService,
  ) {}

  async createSubscription(body: { organizationId: string; email: string }) {
    const { organizationId, email } = body;
    const organizationDetails =
      await this.organizationService.getById(organizationId);
    let customerId = organizationDetails.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripeService.createCustomer(
        organizationDetails.name,
        email,
        organizationId,
      );
      customerId = customer.id;
      await this.organizationService.updateFields(organizationId, {
        stripeCustomerId: customerId,
      });
    }

    const { stripePriceId } = organizationDetails.plan;
    const { trialEndsAt } = organizationDetails;
    const isInTrial = trialEndsAt && trialEndsAt > new Date();
    const subscription = await this.stripeService.createSubscription(
      customerId,
      stripePriceId,
      undefined,
      isInTrial ? trialEndsAt : undefined,
    );
    await this.organizationService.updateFields(organizationId, {
      stripeSubscriptionId: subscription.id,
      paymentStatus: isInTrial ? PaymentStatus.TRIAL : PaymentStatus.ACTIVE,
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

  async getPaymentMethods(auditContext: AuditContextDto) {
    const { organizationId } = auditContext;
    const organizationDetails =
      await this.organizationService.getById(organizationId);
    const { stripeCustomerId } = organizationDetails;
    if (!stripeCustomerId) {
      return null;
    }
    const paymentMethods =
      await this.stripeService.listPaymentMethods(stripeCustomerId);
    return paymentMethods;
  }

  async getInvoices(auditContext: AuditContextDto) {
    const { organizationId } = auditContext;
    const organizationDetails =
      await this.organizationService.getById(organizationId);
    const { stripeCustomerId } = organizationDetails;
    if (!stripeCustomerId) {
      return [];
    }
    const invoices = await this.stripeService.listOfInvoices(stripeCustomerId);
    return invoices;
  }
}
