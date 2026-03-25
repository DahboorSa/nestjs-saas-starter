import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyService } from './api-key.service';

const mockApiKeyService = {
  getByOrgId: jest.fn(),
  create: jest.fn(),
  remove: jest.fn(),
};

const auditContext = { ipAddress: '127.0.0.1', userAgent: 'jest' } as any;
const userInfo = { userId: 'user-1', orgId: 'org-1' } as any;

const mockApiKey = {
  id: 1,
  name: 'Test Key',
  keyPrefix: 'sk_live_ab12',
  scopes: ['read'],
  isActive: true,
  createdAt: new Date(),
  lastUsedAt: null,
};

describe('ApiKeyController', () => {
  let controller: ApiKeyController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiKeyController],
      providers: [{ provide: ApiKeyService, useValue: mockApiKeyService }],
    }).compile();

    controller = module.get<ApiKeyController>(ApiKeyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── GET /api-keys ────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return api keys for the organization', async () => {
      const expected = [mockApiKey];
      mockApiKeyService.getByOrgId.mockResolvedValue(expected);

      const result = await controller.findAll(userInfo);

      expect(result).toEqual(expected);
      expect(mockApiKeyService.getByOrgId).toHaveBeenCalledWith('org-1');
    });
  });

  // ─── POST /api-keys ───────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create and return new api key with message', async () => {
      const body = { name: 'My Key', scopes: ['read'] } as any;
      const expected = {
        message: 'Save this key — it will never be shown again !!',
        apiKey: 'sk_live_abc123...',
        ...mockApiKey,
      };
      mockApiKeyService.create.mockResolvedValue(expected);

      const result = await controller.create(auditContext, userInfo, body);

      expect(result).toEqual(expected);
      expect(mockApiKeyService.create).toHaveBeenCalledWith(
        auditContext,
        userInfo,
        body,
      );
    });
  });

  // ─── DELETE /api-keys/:id ─────────────────────────────────────────────────────

  describe('remove', () => {
    it('should deactivate and return the api key', async () => {
      mockApiKeyService.remove.mockResolvedValue({
        ...mockApiKey,
        isActive: false,
      });

      const result = await controller.remove(auditContext, userInfo, 1);

      expect(result).toMatchObject({ id: 1, isActive: false });
      expect(mockApiKeyService.remove).toHaveBeenCalledWith(
        auditContext,
        userInfo,
        1,
      );
    });
  });
});
