import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionController } from './subscription.controller';
import { BillingService } from './billing.service';
import { PaymentStatus } from '../../enums';

const mockBillingService = {
  getSubscription: jest.fn(),
};

const auditContext = {
  organizationId: 'org-1',
  organizationEmail: 'owner@test.com',
  userId: 'user-1',
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
} as any;

describe('SubscriptionController', () => {
  let controller: SubscriptionController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionController],
      providers: [{ provide: BillingService, useValue: mockBillingService }],
    }).compile();

    controller = module.get<SubscriptionController>(SubscriptionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── GET /subscription ─────────────────────────────────────────────────────

  describe('getSubscription', () => {
    it('should return subscription data', async () => {
      const expected = {
        paymentStatus: PaymentStatus.ACTIVE,
        subscription: {
          id: 'sub_123',
          status: 'active',
          currentPeriodEnd: new Date(),
          cancelAtPeriodEnd: false,
        },
      };
      mockBillingService.getSubscription.mockResolvedValue(expected);

      const result = await controller.getSubscription(auditContext);

      expect(result).toEqual(expected);
      expect(mockBillingService.getSubscription).toHaveBeenCalledWith(
        auditContext,
      );
    });

    it('should return null subscription if no subscription exists', async () => {
      const expected = {
        paymentStatus: PaymentStatus.FREE,
        subscription: null,
      };
      mockBillingService.getSubscription.mockResolvedValue(expected);

      const result = await controller.getSubscription(auditContext);

      expect(result).toEqual(expected);
    });
  });
});
