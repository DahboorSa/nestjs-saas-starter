import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
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
  attachPaymentMethod: jest.fn(),
  createSubscription: jest.fn(),
  retrieveSubscription: jest.fn(),
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

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: StripeService, useValue: mockStripeService },
        { provide: OrganizationService, useValue: mockOrganizationService },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── createSubscription ────────────────────────────────────────────────────

  describe('createSubscription', () => {
    it('should create customer if org has no stripeCustomerId', async () => {
      mockOrganizationService.getById.mockResolvedValue({ ...mockOrg });
      mockStripeService.createCustomer.mockResolvedValue({ id: 'cus_new' });
      mockStripeService.attachPaymentMethod.mockResolvedValue({});
      mockStripeService.createSubscription.mockResolvedValue({
        id: 'sub_123',
        status: 'active',
      });

      const result = await service.createSubscription(auditContext, {
        paymentMethodId: 'pm_123',
      } as any);

      expect(mockStripeService.createCustomer).toHaveBeenCalledWith(
        'Test Org',
        'owner@test.com',
        'org-1',
      );
      expect(mockOrganizationService.updateFields).toHaveBeenCalledWith(
        'org-1',
        { stripeCustomerId: 'cus_new' },
      );
      expect(mockStripeService.attachPaymentMethod).toHaveBeenCalledWith(
        'pm_123',
        'cus_new',
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
      mockStripeService.attachPaymentMethod.mockResolvedValue({});
      mockStripeService.createSubscription.mockResolvedValue({
        id: 'sub_123',
        status: 'active',
      });

      await service.createSubscription(auditContext, {
        paymentMethodId: 'pm_123',
      } as any);

      expect(mockStripeService.createCustomer).not.toHaveBeenCalled();
      expect(mockStripeService.attachPaymentMethod).toHaveBeenCalledWith(
        'pm_123',
        'cus_existing',
      );
    });

    it('should save subscriptionId and set paymentStatus to ACTIVE', async () => {
      mockOrganizationService.getById.mockResolvedValue({
        ...mockOrg,
        stripeCustomerId: 'cus_existing',
      });
      mockStripeService.attachPaymentMethod.mockResolvedValue({});
      mockStripeService.createSubscription.mockResolvedValue({
        id: 'sub_123',
        status: 'active',
      });

      await service.createSubscription(auditContext, {
        paymentMethodId: 'pm_123',
      } as any);

      expect(mockOrganizationService.updateFields).toHaveBeenCalledWith(
        'org-1',
        { stripeSubscriptionId: 'sub_123', paymentStatus: PaymentStatus.ACTIVE },
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
      });
      expect(mockStripeService.retrieveSubscription).not.toHaveBeenCalled();
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

      expect(result).toEqual({
        paymentStatus: PaymentStatus.ACTIVE,
        subscription: {
          id: 'sub_123',
          status: 'active',
          currentPeriodEnd: new Date(periodEnd * 1000),
          cancelAtPeriodEnd: false,
        },
      });
    });
  });
});
