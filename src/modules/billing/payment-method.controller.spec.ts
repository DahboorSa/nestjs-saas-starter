import { Test, TestingModule } from '@nestjs/testing';
import { PaymentMethodController } from './payment-method.controller';
import { BillingService } from './billing.service';

const mockBillingService = {
  getPaymentMethods: jest.fn(),
};

const auditContext = {
  organizationId: 'org-1',
  organizationEmail: 'owner@test.com',
  userId: 'user-1',
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
} as any;

describe('PaymentMethodController', () => {
  let controller: PaymentMethodController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentMethodController],
      providers: [{ provide: BillingService, useValue: mockBillingService }],
    }).compile();

    controller = module.get<PaymentMethodController>(PaymentMethodController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── GET /payment-methods ───────────────────────────────────────────────────

  describe('getPaymentMethods', () => {
    it('should return payment methods from the billing service', async () => {
      const expected = { data: [{ id: 'pm_123' }] };
      mockBillingService.getPaymentMethods.mockResolvedValue(expected);

      const result = await controller.getPaymentMethods(auditContext);

      expect(result).toEqual(expected);
      expect(mockBillingService.getPaymentMethods).toHaveBeenCalledWith(
        auditContext,
      );
    });
  });
});
