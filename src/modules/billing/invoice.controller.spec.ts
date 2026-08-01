import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceController } from './invoice.controller';
import { BillingService } from './billing.service';

const mockBillingService = {
  getInvoices: jest.fn(),
};

const auditContext = {
  organizationId: 'org-1',
  organizationEmail: 'owner@test.com',
  userId: 'user-1',
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
} as any;

describe('InvoiceController', () => {
  let controller: InvoiceController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoiceController],
      providers: [{ provide: BillingService, useValue: mockBillingService }],
    }).compile();

    controller = module.get<InvoiceController>(InvoiceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── GET /invoices ──────────────────────────────────────────────────────────

  describe('getInvoices', () => {
    it('should return invoices from the billing service', async () => {
      const expected = { data: [{ id: 'in_123' }] };
      mockBillingService.getInvoices.mockResolvedValue(expected);

      const result = await controller.getInvoices(auditContext);

      expect(result).toEqual(expected);
      expect(mockBillingService.getInvoices).toHaveBeenCalledWith(auditContext);
    });
  });
});
