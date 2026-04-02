import { Test, TestingModule } from '@nestjs/testing';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { WebhookTrackerInterceptor } from './interceptors/webhook-tracker.interceptor';
import { WebhookEvent } from '../../enums';

const mockWebhookService = {
  findAll: jest.fn(),
  create: jest.fn(),
  remove: jest.fn(),
};

const auditContext = {
  organizationId: 'org-1',
  userId: 'user-1',
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
} as any;

const mockWebhook = {
  id: 'webhook-1',
  url: 'https://example.com/webhook',
  events: [WebhookEvent.MEMBER_INVITED],
  isActive: true,
  createdAt: new Date(),
};

describe('WebhookController', () => {
  let controller: WebhookController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [{ provide: WebhookService, useValue: mockWebhookService }],
    })
      .overrideInterceptor(WebhookTrackerInterceptor)
      .useValue({ intercept: jest.fn((_ctx, next) => next.handle()) })
      .compile();

    controller = module.get<WebhookController>(WebhookController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── GET /webhooks ────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all active webhooks for the org', async () => {
      mockWebhookService.findAll.mockResolvedValue([mockWebhook]);

      const result = await controller.findAll(auditContext);

      expect(result).toEqual([mockWebhook]);
      expect(mockWebhookService.findAll).toHaveBeenCalledWith('org-1');
    });

    it('should return empty array if no webhooks exist', async () => {
      mockWebhookService.findAll.mockResolvedValue([]);

      const result = await controller.findAll(auditContext);

      expect(result).toEqual([]);
    });
  });

  // ─── POST /webhooks ───────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create and return new webhook with secret', async () => {
      const body = {
        url: 'https://example.com/webhook',
        events: [WebhookEvent.MEMBER_INVITED],
      } as any;
      const expected = { ...mockWebhook, secret: 'abc123secret' };
      mockWebhookService.create.mockResolvedValue(expected);

      const result = await controller.create(auditContext, body);

      expect(result).toEqual(expected);
      expect(mockWebhookService.create).toHaveBeenCalledWith(
        auditContext,
        body,
      );
    });
  });

  // ─── DELETE /webhooks/:id ─────────────────────────────────────────────────────

  describe('delete', () => {
    it('should deactivate webhook and return mapped data', async () => {
      const expected = { ...mockWebhook, isActive: false };
      mockWebhookService.remove.mockResolvedValue(expected);

      const result = await controller.delete(auditContext, 'webhook-1');

      expect(result).toEqual(expected);
      expect(mockWebhookService.remove).toHaveBeenCalledWith(
        auditContext,
        'webhook-1',
      );
    });
  });
});
