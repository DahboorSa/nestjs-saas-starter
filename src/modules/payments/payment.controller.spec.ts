import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentStatus } from '../../enums';

const mockPaymentService = {
  createSubscription: jest.fn(),
  getSubscription: jest.fn(),
};

const auditContext = {
  organizationId: 'org-1',
  organizationEmail: 'owner@test.com',
  userId: 'user-1',
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
} as any;

describe('PaymentController', () => {
  let controller: PaymentController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [{ provide: PaymentService, useValue: mockPaymentService }],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── POST /payments/subscription ──────────────────────────────────────────

  describe('createSubscription', () => {
    it('should return success message with subscriptionId and status', async () => {
      const expected = {
        message: 'Subscription created successfully',
        subscriptionId: 'sub_123',
        status: 'active',
      };
      mockPaymentService.createSubscription.mockResolvedValue(expected);

      const result = await controller.createSubscription(auditContext, {
        paymentMethodId: 'pm_123',
      } as any);

      expect(result).toEqual(expected);
      expect(mockPaymentService.createSubscription).toHaveBeenCalledWith(
        auditContext,
        { paymentMethodId: 'pm_123' },
      );
    });
  });

  // ─── GET /payments/subscription ───────────────────────────────────────────

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
      mockPaymentService.getSubscription.mockResolvedValue(expected);

      const result = await controller.getSubscription(auditContext);

      expect(result).toEqual(expected);
      expect(mockPaymentService.getSubscription).toHaveBeenCalledWith(
        auditContext,
      );
    });

    it('should return null subscription if no subscription exists', async () => {
      const expected = { paymentStatus: PaymentStatus.FREE, subscription: null };
      mockPaymentService.getSubscription.mockResolvedValue(expected);

      const result = await controller.getSubscription(auditContext);

      expect(result).toEqual(expected);
    });
  });
});
