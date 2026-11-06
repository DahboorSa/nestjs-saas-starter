import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeyService } from './api-key.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ApiKeyEntity } from './entities/api-key.entity';
import { OrganizationService } from '../organizations/organization.service';
import { CacheService } from '../../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { WebhookDispatcherService } from '../webhook-dispatchers/webhook-dispatcher.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

const mockApiKeyRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  merge: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
};

const mockOrganizationService = {
  getById: jest.fn(),
  getDetails: jest.fn(),
};

const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  setIfAbsent: jest.fn(),
};
const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'API_KEY_PREFIX') return 'sk_live_';
    if (key === 'API_KEY_EXPIRATION') return '300';
    return null;
  }),
};
const mockAuditLogService = { create: jest.fn().mockResolvedValue(undefined) };
const mockDispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };

const auditContext = { ipAddress: '127.0.0.1', userAgent: 'jest' };
const userInfo = { userId: 'user-1', orgId: 'org-1' } as any;

const mockOrg = {
  id: 'org-1',
  isActive: true,
  plan: { limits: { maxApiKeys: 5 } },
};

const mockApiKey: Partial<ApiKeyEntity> = {
  id: 1,
  name: 'Test Key',
  keyHash: 'hash-123',
  keyPrefix: 'sk_live_ab12',
  scopes: ['read'],
  isActive: true,
  createdAt: new Date(),
  lastUsedAt: null,
  organization: { id: 'org-1' } as any,
};

describe('ApiKeyService', () => {
  let service: ApiKeyService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAuditLogService.create.mockResolvedValue(undefined);
    mockDispatcher.dispatch.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyService,
        {
          provide: getRepositoryToken(ApiKeyEntity),
          useValue: mockApiKeyRepository,
        },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: WebhookDispatcherService, useValue: mockDispatcher },
      ],
    }).compile();

    service = module.get<ApiKeyService>(ApiKeyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('hashKey', () => {
    it('should return a consistent SHA256 hash', () => {
      const hash1 = service.hashKey('my-api-key');
      const hash2 = service.hashKey('my-api-key');

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('should return different hashes for different keys', () => {
      expect(service.hashKey('key-a')).not.toBe(service.hashKey('key-b'));
    });
  });

  describe('getByHash', () => {
    it('should return null if key not found', async () => {
      mockApiKeyRepository.findOne.mockResolvedValue(null);

      const result = await service.getByHash('unknown-hash');

      expect(result).toBeNull();
    });

    it('should return mapped key data if found', async () => {
      mockApiKeyRepository.findOne.mockResolvedValue(mockApiKey);

      const result = await service.getByHash('hash-123');

      expect(result).toMatchObject({ id: 1, name: 'Test Key' });
    });

    it('should include expiresAt so the auth strategy can enforce it', async () => {
      const expiresAt = new Date(Date.now() + 86400000);
      mockApiKeyRepository.findOne.mockResolvedValue({
        ...mockApiKey,
        expiresAt,
      });

      const result = await service.getByHash('hash-123');

      expect(result?.expiresAt).toEqual(expiresAt);
    });
  });

  describe('markUsed', () => {
    const flush = () => new Promise((resolve) => setImmediate(resolve));

    it('should write last_used_at for the first request in the window', async () => {
      mockCacheService.setIfAbsent.mockResolvedValue(true);
      mockApiKeyRepository.update.mockResolvedValue(undefined);

      service.markUsed(1);
      await flush();

      expect(mockCacheService.setIfAbsent).toHaveBeenCalledWith(
        'apikey:used:1',
        '1',
        60,
      );
      expect(mockApiKeyRepository.update).toHaveBeenCalledWith(1, {
        lastUsedAt: expect.any(Date),
      });
    });

    it('should skip the write for later requests in the same window', async () => {
      mockCacheService.setIfAbsent.mockResolvedValue(false);

      service.markUsed(1);
      await flush();

      expect(mockApiKeyRepository.update).not.toHaveBeenCalled();
    });

    it('should swallow errors so a request never fails over it', async () => {
      mockCacheService.setIfAbsent.mockRejectedValue(new Error('redis down'));

      expect(() => service.markUsed(1)).not.toThrow();
      await flush();

      expect(mockApiKeyRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('cacheValidKey', () => {
    it('should store the entry under the hash with the configured TTL', async () => {
      mockCacheService.set.mockResolvedValue(undefined);
      const entry = {
        id: 1,
        orgId: 'org-1',
        scopes: ['read'],
        expiresAt: null,
      };

      await service.cacheValidKey('abc', entry);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        'apikey:valid:abc',
        JSON.stringify(entry),
        300,
      );
    });
  });

  describe('getByOrgId', () => {
    it('should throw NotFoundException if organization not found', async () => {
      mockOrganizationService.getById.mockResolvedValue(null);

      await expect(service.getByOrgId('org-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if organization is not active', async () => {
      mockOrganizationService.getById.mockResolvedValue({
        id: 'org-1',
        isActive: false,
      });

      await expect(service.getByOrgId('org-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return list of mapped api keys', async () => {
      mockOrganizationService.getById.mockResolvedValue(mockOrg);
      mockApiKeyRepository.find.mockResolvedValue([mockApiKey]);

      const result = await service.getByOrgId('org-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 1, name: 'Test Key' });
    });

    it('should return empty array if no keys exist', async () => {
      mockOrganizationService.getById.mockResolvedValue(mockOrg);
      mockApiKeyRepository.find.mockResolvedValue([]);

      const result = await service.getByOrgId('org-1');

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    const createDto = { name: 'My Key', scopes: ['read'] };

    it('should throw NotFoundException if organization not found', async () => {
      mockOrganizationService.getDetails.mockResolvedValue(null);

      await expect(
        service.create(auditContext as any, userInfo, createDto as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if organization is not active', async () => {
      mockOrganizationService.getDetails.mockResolvedValue({
        ...mockOrg,
        isActive: false,
      });

      await expect(
        service.create(auditContext as any, userInfo, createDto as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if max api keys limit is reached', async () => {
      mockOrganizationService.getDetails.mockResolvedValue({
        ...mockOrg,
        plan: { limits: { maxApiKeys: 2 } },
      });
      mockApiKeyRepository.count.mockResolvedValue(2);

      await expect(
        service.create(auditContext as any, userInfo, createDto as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create and return api key with message', async () => {
      mockOrganizationService.getDetails.mockResolvedValue(mockOrg);
      mockApiKeyRepository.count.mockResolvedValue(1);
      mockApiKeyRepository.create.mockReturnValue({ ...mockApiKey });
      mockApiKeyRepository.save.mockResolvedValue({ ...mockApiKey });
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.create(
        auditContext as any,
        userInfo,
        createDto as any,
      );

      expect(result.message).toBe(
        'Save this key — it will never be shown again !!',
      );
      expect(result.apiKey).toMatch(/^sk_live_/);
    });

    it('should store the requested expiry and cache it for the auth strategy', async () => {
      const expiresAt = new Date(Date.now() + 86400000);
      mockOrganizationService.getDetails.mockResolvedValue(mockOrg);
      mockApiKeyRepository.count.mockResolvedValue(1);
      mockApiKeyRepository.create.mockReturnValue({ ...mockApiKey });
      mockApiKeyRepository.save.mockResolvedValue({ ...mockApiKey });
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.create(auditContext as any, userInfo, {
        ...createDto,
        expiresAt,
      } as any);

      expect(mockApiKeyRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ expiresAt }),
      );
      const cachedValue = JSON.parse(mockCacheService.set.mock.calls[0][1]);
      expect(cachedValue.expiresAt).toBe(expiresAt.toISOString());
      expect(result.expiresAt).toEqual(expiresAt);
    });

    it('should leave the expiry unset when none is requested', async () => {
      mockOrganizationService.getDetails.mockResolvedValue(mockOrg);
      mockApiKeyRepository.count.mockResolvedValue(1);
      mockApiKeyRepository.create.mockReturnValue({ ...mockApiKey });
      mockApiKeyRepository.save.mockResolvedValue({ ...mockApiKey });
      mockCacheService.set.mockResolvedValue(undefined);

      await service.create(auditContext as any, userInfo, createDto as any);

      const cachedValue = JSON.parse(mockCacheService.set.mock.calls[0][1]);
      expect(cachedValue.expiresAt).toBeNull();
    });

    it('should cache only what the auth strategy needs', async () => {
      mockOrganizationService.getDetails.mockResolvedValue(mockOrg);
      mockApiKeyRepository.count.mockResolvedValue(1);
      mockApiKeyRepository.create.mockReturnValue({ ...mockApiKey, id: 7 });
      mockApiKeyRepository.save.mockResolvedValue({ ...mockApiKey });
      mockCacheService.set.mockResolvedValue(undefined);

      await service.create(auditContext as any, userInfo, createDto as any);

      const [key, value, ttl] = mockCacheService.set.mock.calls[0];
      expect(key).toMatch(/^apikey:valid:[0-9a-f]{64}$/);
      expect(Object.keys(JSON.parse(value)).sort()).toEqual([
        'expiresAt',
        'id',
        'orgId',
        'scopes',
      ]);
      expect(ttl).toBe(300);
    });

    it('should not enforce limit if maxApiKeys is -1 (unlimited)', async () => {
      mockOrganizationService.getDetails.mockResolvedValue({
        ...mockOrg,
        plan: { limits: { maxApiKeys: -1 } },
      });
      mockApiKeyRepository.count.mockResolvedValue(100);
      mockApiKeyRepository.create.mockReturnValue({ ...mockApiKey });
      mockApiKeyRepository.save.mockResolvedValue({ ...mockApiKey });
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.create(
        auditContext as any,
        userInfo,
        createDto as any,
      );

      expect(result.apiKey).toBeDefined();
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException if api key not found', async () => {
      mockApiKeyRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.remove(auditContext as any, userInfo, 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if api key is already removed', async () => {
      mockApiKeyRepository.findOneBy.mockResolvedValue({
        ...mockApiKey,
        isActive: false,
      });

      await expect(
        service.remove(auditContext as any, userInfo, 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deactivate key, invalidate cache and return mapped data', async () => {
      mockApiKeyRepository.findOneBy.mockResolvedValue(mockApiKey);
      mockApiKeyRepository.merge.mockReturnValue(undefined);
      mockApiKeyRepository.save.mockResolvedValue({
        ...mockApiKey,
        isActive: false,
      });
      mockCacheService.delete.mockResolvedValue(undefined);

      const result = await service.remove(auditContext as any, userInfo, 1);

      expect(result).toMatchObject({ id: 1, name: 'Test Key' });
      expect(mockCacheService.delete).toHaveBeenCalledWith(
        `apikey:valid:${mockApiKey.keyHash}`,
      );
    });
  });
});
