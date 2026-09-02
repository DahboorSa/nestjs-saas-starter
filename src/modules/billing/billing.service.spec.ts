import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from './billing.service';
import { StripeService } from '../stripe/stripe.service';
import { OrganizationService } from '../organizations/organization.service';
import { PaymentStatus } from '../../enums';

const mockOrg = {
  id: 'org-1',
  name: 'Test Org',
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  paymentStatus: PaymentStatus.FREE,
  plan: { stripePriceId: 'price_123' },
};

const mockStripeService = {
  createCustomer: jest.fn(),
  createSubscription: jest.fn(),
  retrieveSubscription: jest.fn(),
  listPaymentMethods: jest.fn(),
  listOfInvoices: jest.fn(),
};

const mockOrganizationService = {
  getById: jest.fn(),
  updateFields: jest.fn(),
};

const auditContext = {
  organizationId: 'org-1',
  organizationEmail: 'owner@test.com',
  userId: 'user-1',
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
} as any;

describe('BillingService', () => {
  let service: BillingService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: StripeService, useValue: mockStripeService },
        { provide: OrganizationService, useValue: mockOrganizationService },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── createSubscription ────────────────────────────────────────────────────

  describe('createSubscription', () => {
    it('should create customer if org has no stripeCustomerId', async () => {
      mockOrganizationService.getById.mockResolvedValue({ ...mockOrg });
      mockStripeService.createCustomer.mockResolvedValue({ id: 'cus_new' });
      mockStripeService.createSubscription.mockResolvedValue({
        id: 'sub_123',
        status: 'active',
      });

      const result = await service.createSubscription({
        organizationId: 'org-1',
        email: 'owner@test.com',
      });

      expect(mockStripeService.createCustomer).toHaveBeenCalledWith(
        'Test Org',
        'owner@test.com',
        'org-1',
      );
      expect(mockOrganizationService.updateFields).toHaveBeenCalledWith(
        'org-1',
        { stripeCustomerId: 'cus_new' },
      );
      expect(mockStripeService.createSubscription).toHaveBeenCalledWith(
        'cus_new',
        'price_123',
        undefined,
        undefined,
      );
      expect(result).toEqual({
        message: 'Subscription created successfully',
        subscriptionId: 'sub_123',
        status: 'active',
      });
    });

    it('should reuse existing stripeCustomerId', async () => {
      mockOrganizationService.getById.mockResolvedValue({
        ...mockOrg,
        stripeCustomerId: 'cus_existing',
      });
      mockStripeService.createSubscription.mockResolvedValue({
        id: 'sub_123',
        status: 'active',
      });

      await service.createSubscription({
        organizationId: 'org-1',
        email: 'owner@test.com',
      });

      expect(mockStripeService.createCustomer).not.toHaveBeenCalled();
      expect(mockStripeService.createSubscription).toHaveBeenCalledWith(
        'cus_existing',
        'price_123',
        undefined,
        undefined,
      );
    });

    it('should save subscriptionId and set paymentStatus to ACTIVE when not in trial', async () => {
      mockOrganizationService.getById.mockResolvedValue({
        ...mockOrg,
        stripeCustomerId: 'cus_existing',
      });
      mockStripeService.createSubscription.mockResolvedValue({
        id: 'sub_123',
        status: 'active',
      });

      await service.createSubscription({
        organizationId: 'org-1',
        email: 'owner@test.com',
      });

      expect(mockOrganizationService.updateFields).toHaveBeenCalledWith(
        'org-1',
        {
          stripeSubscriptionId: 'sub_123',
          paymentStatus: PaymentStatus.ACTIVE,
        },
      );
    });

    it('should pass trialEndsAt and set paymentStatus to TRIAL when org is in trial', async () => {
      const trialEndsAt = new Date(Date.now() + 86400 * 1000);
      mockOrganizationService.getById.mockResolvedValue({
        ...mockOrg,
        stripeCustomerId: 'cus_existing',
        trialEndsAt,
      });
      mockStripeService.createSubscription.mockResolvedValue({
        id: 'sub_123',
        status: 'trialing',
      });

      await service.createSubscription({
        organizationId: 'org-1',
        email: 'owner@test.com',
      });

      expect(mockStripeService.createSubscription).toHaveBeenCalledWith(
        'cus_existing',
        'price_123',
        undefined,
        trialEndsAt,
      );
      expect(mockOrganizationService.updateFields).toHaveBeenCalledWith(
        'org-1',
        {
          stripeSubscriptionId: 'sub_123',
          paymentStatus: PaymentStatus.TRIAL,
        },
      );
    });
  });

  // ─── getSubscription ───────────────────────────────────────────────────────

  describe('getSubscription', () => {
    it('should return null subscription if org has no stripeSubscriptionId', async () => {
      mockOrganizationService.getById.mockResolvedValue({ ...mockOrg });

      const result = await service.getSubscription(auditContext);

      expect(result).toEqual({
        paymentStatus: PaymentStatus.FREE,
        subscription: null,
        paymentMethods: [],
      });
      expect(mockStripeService.retrieveSubscription).not.toHaveBeenCalled();
      expect(mockStripeService.listPaymentMethods).not.toHaveBeenCalled();
    });

    it('should return mapped subscription data', async () => {
      const periodEnd = Math.floor(Date.now() / 1000) + 86400;
      mockOrganizationService.getById.mockResolvedValue({
        ...mockOrg,
        stripeSubscriptionId: 'sub_123',
        paymentStatus: PaymentStatus.ACTIVE,
      });
      mockStripeService.retrieveSubscription.mockResolvedValue({
        id: 'sub_123',
        status: 'active',
        current_period_end: periodEnd,
        cancel_at_period_end: false,
      });

      const result = await service.getSubscription(auditContext);

      expect(mockStripeService.retrieveSubscription).toHaveBeenCalledWith(
        'sub_123',
        ['default_payment_method'],
      );
      expect(result).toEqual({
        paymentStatus: PaymentStatus.ACTIVE,
        subscription: {
          id: 'sub_123',
          status: 'active',
          currentPeriodEnd: new Date(periodEnd * 1000),
          cancelAtPeriodEnd: false,
        },
        paymentMethods: [],
      });
    });

    it('should include shaped payment methods and flag the subscription default', async () => {
      const periodEnd = Math.floor(Date.now() / 1000) + 86400;
      mockOrganizationService.getById.mockResolvedValue({
        ...mockOrg,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        paymentStatus: PaymentStatus.ACTIVE,
      });
      mockStripeService.listPaymentMethods.mockResolvedValue({
        data: [
          {
            id: 'pm_default',
            card: {
              brand: 'visa',
              last4: '4242',
              exp_month: 12,
              exp_year: 2030,
            },
          },
          {
            id: 'pm_other',
            card: {
              brand: 'amex',
              last4: '0005',
              exp_month: 1,
              exp_year: 2028,
            },
          },
        ],
      });
      mockStripeService.retrieveSubscription.mockResolvedValue({
        id: 'sub_123',
        status: 'active',
        current_period_end: periodEnd,
        cancel_at_period_end: false,
        default_payment_method: { id: 'pm_default' },
      });

      const result = await service.getSubscription(auditContext);

      expect(mockStripeService.listPaymentMethods).toHaveBeenCalledWith(
        'cus_123',
      );
      expect(result.paymentMethods).toEqual([
        {
          id: 'pm_default',
          brand: 'visa',
          last4: '4242',
          expMonth: 12,
          expYear: 2030,
          isDefault: true,
        },
        {
          id: 'pm_other',
          brand: 'amex',
          last4: '0005',
          expMonth: 1,
          expYear: 2028,
          isDefault: false,
        },
      ]);
    });
  });

  // ─── getPaymentMethods ──────────────────────────────────────────────────────

  describe('getPaymentMethods', () => {
    it('should return null if org has no stripeCustomerId', async () => {
      mockOrganizationService.getById.mockResolvedValue({ ...mockOrg });

      const result = await service.getPaymentMethods(auditContext);

      expect(result).toBeNull();
      expect(mockStripeService.listPaymentMethods).not.toHaveBeenCalled();
    });

    it('should return payment methods from stripe', async () => {
      mockOrganizationService.getById.mockResolvedValue({
        ...mockOrg,
        stripeCustomerId: 'cus_123',
      });
      const expected = { data: [{ id: 'pm_123' }] };
      mockStripeService.listPaymentMethods.mockResolvedValue(expected);

      const result = await service.getPaymentMethods(auditContext);

      expect(mockStripeService.listPaymentMethods).toHaveBeenCalledWith(
        'cus_123',
      );
      expect(result).toEqual(expected);
    });
  });

  // ─── getInvoices ────────────────────────────────────────────────────────────

  describe('getInvoices', () => {
    it('should return empty array if org has no stripeCustomerId', async () => {
      mockOrganizationService.getById.mockResolvedValue({ ...mockOrg });

      const result = await service.getInvoices(auditContext);

      expect(result).toEqual([]);
      expect(mockStripeService.listOfInvoices).not.toHaveBeenCalled();
    });

    it('should return invoices from stripe', async () => {
      mockOrganizationService.getById.mockResolvedValue({
        ...mockOrg,
        stripeCustomerId: 'cus_123',
      });
      const expected = { data: [{ id: 'in_123' }] };
      mockStripeService.listOfInvoices.mockResolvedValue(expected);

      const result = await service.getInvoices(auditContext);

      expect(mockStripeService.listOfInvoices).toHaveBeenCalledWith('cus_123');
      expect(result).toEqual(expected);
    });
  });
});
