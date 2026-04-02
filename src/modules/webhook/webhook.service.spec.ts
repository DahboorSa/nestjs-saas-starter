import { Test, TestingModule } from '@nestjs/testing';
import { WebhookService } from './webhook.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WebhookEndpointEntity } from './entities/webhook-endpoint.entity';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { NotFoundException } from '@nestjs/common';
import { WebhookEvent } from '../../enums';

const mockWebhookRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  merge: jest.fn(),
  count: jest.fn(),
};

const mockAuditLogService = { create: jest.fn().mockResolvedValue(undefined) };

const auditContext = { ipAddress: '127.0.0.1', userAgent: 'jest' } as any;

const mockWebhook: Partial<WebhookEndpointEntity> = {
  id: 'webhook-1',
  url: 'https://example.com/webhook',
  events: [WebhookEvent.MEMBER_INVITED],
  isActive: true,
  secret: 'secret-abc',
  createdAt: new Date(),
  organization: { id: 'org-1' } as any,
};

describe('WebhookService', () => {
  let service: WebhookService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAuditLogService.create.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: getRepositoryToken(WebhookEndpointEntity),
          useValue: mockWebhookRepository,
        },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── findAll ──────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return mapped active webhooks for org', async () => {
      mockWebhookRepository.find.mockResolvedValue([mockWebhook]);

      const result = await service.findAll('org-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'webhook-1',
        url: 'https://example.com/webhook',
        isActive: true,
      });
      expect(result[0]).not.toHaveProperty('secret');
      expect(mockWebhookRepository.find).toHaveBeenCalledWith({
        where: { organization: { id: 'org-1' }, isActive: true },
      });
    });

    it('should return empty array if no webhooks exist', async () => {
      mockWebhookRepository.find.mockResolvedValue([]);

      const result = await service.findAll('org-1');

      expect(result).toEqual([]);
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create webhook and return it with secret', async () => {
      const body = {
        url: 'https://example.com/webhook',
        events: [WebhookEvent.MEMBER_INVITED],
      } as any;
      mockWebhookRepository.create.mockReturnValue(mockWebhook);
      mockWebhookRepository.save.mockResolvedValue(mockWebhook);

      const result = await service.create(auditContext, body);

      expect(result).toMatchObject({
        id: 'webhook-1',
        url: 'https://example.com/webhook',
      });
      expect(result).toHaveProperty('secret');
      expect(mockWebhookRepository.create).toHaveBeenCalled();
      expect(mockWebhookRepository.save).toHaveBeenCalled();
    });

    it('should fire audit log after creation', async () => {
      const body = {
        url: 'https://example.com/webhook',
        events: [WebhookEvent.MEMBER_INVITED],
      } as any;
      mockWebhookRepository.create.mockReturnValue(mockWebhook);
      mockWebhookRepository.save.mockResolvedValue(mockWebhook);

      await service.create(auditContext, body);

      await new Promise(process.nextTick);
      expect(mockAuditLogService.create).toHaveBeenCalled();
    });
  });

  // ─── getActiveWebhookEvents ───────────────────────────────────────────────────

  describe('getActiveWebhookEvents', () => {
    it('should return count of active webhooks', async () => {
      mockWebhookRepository.count.mockResolvedValue(3);

      const result = await service.getActiveWebhookEvents('org-1');

      expect(result).toBe(3);
      expect(mockWebhookRepository.count).toHaveBeenCalledWith({
        where: { isActive: true, organization: { id: 'org-1' } },
      });
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should throw NotFoundException if webhook not found', async () => {
      mockWebhookRepository.findOneBy.mockResolvedValue(null);

      await expect(service.remove(auditContext, 'webhook-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if webhook already removed', async () => {
      mockWebhookRepository.findOneBy.mockResolvedValue({
        ...mockWebhook,
        isActive: false,
      });

      await expect(service.remove(auditContext, 'webhook-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should deactivate webhook and return mapped data', async () => {
      mockWebhookRepository.findOneBy.mockResolvedValue(mockWebhook);
      mockWebhookRepository.merge.mockReturnValue(undefined);
      mockWebhookRepository.save.mockResolvedValue({
        ...mockWebhook,
        isActive: false,
      });

      const result = await service.remove(auditContext, 'webhook-1');

      expect(result).toMatchObject({ id: 'webhook-1', isActive: false });
      expect(result).not.toHaveProperty('secret');
    });
  });
});
