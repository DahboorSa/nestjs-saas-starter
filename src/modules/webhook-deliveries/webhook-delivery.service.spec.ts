import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookDeliveryEntity } from './entities/webhook-delivery.entity';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { DeliveryStatus } from '../../enums';

const mockRepository = {
  save: jest.fn(),
  update: jest.fn(),
  findOneBy: jest.fn(),
};
const mockAuditLogService = { create: jest.fn() };

describe('WebhookDeliveryService', () => {
  let service: WebhookDeliveryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAuditLogService.create.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookDeliveryService,
        {
          provide: getRepositoryToken(WebhookDeliveryEntity),
          useValue: mockRepository,
        },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();
    service = module.get(WebhookDeliveryService);
  });

  describe('createPending', () => {
    it('saves a PENDING row linked to the endpoint and returns its id', async () => {
      mockRepository.save.mockResolvedValue({ id: 'delivery-1' });

      const id = await service.createPending('endpoint-1', {
        event: 'member.invited',
        payload: { a: 1 },
      });

      expect(id).toBe('delivery-1');
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: DeliveryStatus.PENDING,
          attempt: 0,
          webhookEndpoint: { id: 'endpoint-1' },
        }),
      );
    });
  });

  describe('recordAttempt', () => {
    it('updates the row without auditing when not successful', async () => {
      await service.recordAttempt('delivery-1', 'org-1', {
        status: DeliveryStatus.FAILED,
        statusCode: 500,
        attempt: 2,
      });

      expect(mockRepository.update).toHaveBeenCalledWith('delivery-1', {
        status: DeliveryStatus.FAILED,
        statusCode: 500,
        attempt: 2,
      });
      expect(mockAuditLogService.create).not.toHaveBeenCalled();
    });

    it('writes a webhook.delivered audit log on success', async () => {
      mockRepository.findOneBy.mockResolvedValue({ payload: { a: 1 } });

      await service.recordAttempt('delivery-1', 'org-1', {
        status: DeliveryStatus.SUCCESS,
        statusCode: 200,
        attempt: 0,
      });

      expect(mockAuditLogService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: 'delivery-1',
          metadata: { payload: { a: 1 } },
          organization: { id: 'org-1' },
        }),
      );
    });
  });
});
