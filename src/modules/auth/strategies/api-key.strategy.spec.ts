import { UnauthorizedException } from '@nestjs/common';
import { ApiKeyStrategy } from './api-key.strategy';

const mockApiKeyService = {
  hashKey: jest.fn().mockReturnValue('hash'),
  getByHash: jest.fn(),
  markUsed: jest.fn(),
  cacheValidKey: jest.fn(),
};
const mockCacheService = { get: jest.fn() };
const mockConfigService = {
  getOrThrow: jest.fn().mockReturnValue('sk_test_'),
};

const past = new Date(Date.now() - 60_000).toISOString();
const future = new Date(Date.now() + 60_000).toISOString();
const req = (token = 'sk_test_abc') =>
  ({ headers: { authorization: `Bearer ${token}` } }) as any;

describe('ApiKeyStrategy', () => {
  let strategy: ApiKeyStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockApiKeyService.cacheValidKey.mockResolvedValue(undefined);
    strategy = new ApiKeyStrategy(
      mockApiKeyService as any,
      mockCacheService as any,
      mockConfigService as any,
    );
  });

  describe('cached key', () => {
    const cached = (expiresAt: string | null) =>
      JSON.stringify({ id: 1, orgId: 'org-1', scopes: ['read'], expiresAt });

    it('should authenticate a cached key with no expiry', async () => {
      mockCacheService.get.mockResolvedValue(cached(null));

      await expect(strategy.validate(req())).resolves.toEqual({
        orgId: 'org-1',
        scopes: ['read'],
        isApiKey: true,
      });
      expect(mockApiKeyService.getByHash).not.toHaveBeenCalled();
      expect(mockApiKeyService.markUsed).toHaveBeenCalledWith(1);
    });

    it('should authenticate a cached key that has not expired yet', async () => {
      mockCacheService.get.mockResolvedValue(cached(future));

      await expect(strategy.validate(req())).resolves.toMatchObject({
        orgId: 'org-1',
      });
    });

    it('should reject a cached key that has expired', async () => {
      mockCacheService.get.mockResolvedValue(cached(past));

      await expect(strategy.validate(req())).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockApiKeyService.markUsed).not.toHaveBeenCalled();
    });
  });

  describe('database lookup', () => {
    const stored = {
      id: 1,
      orgId: 'org-1',
      scopes: ['read'],
      isActive: true,
      expiresAt: future,
    };

    beforeEach(() => mockCacheService.get.mockResolvedValue(null));

    it('should authenticate an active key and cache it for next time', async () => {
      mockApiKeyService.getByHash.mockResolvedValue(stored);

      await expect(strategy.validate(req())).resolves.toEqual({
        orgId: 'org-1',
        scopes: ['read'],
        isApiKey: true,
      });
      expect(mockApiKeyService.cacheValidKey).toHaveBeenCalledWith('hash', {
        id: 1,
        orgId: 'org-1',
        scopes: ['read'],
        expiresAt: future,
      });
      expect(mockApiKeyService.markUsed).toHaveBeenCalledWith(1);
    });

    it('should still authenticate when caching fails', async () => {
      mockApiKeyService.getByHash.mockResolvedValue(stored);
      mockApiKeyService.cacheValidKey.mockRejectedValue(
        new Error('redis down'),
      );

      await expect(strategy.validate(req())).resolves.toMatchObject({
        orgId: 'org-1',
      });
    });

    it('should reject an expired key and not cache it', async () => {
      mockApiKeyService.getByHash.mockResolvedValue({
        ...stored,
        expiresAt: past,
      });

      await expect(strategy.validate(req())).rejects.toThrow(
        'API key has expired',
      );
      expect(mockApiKeyService.cacheValidKey).not.toHaveBeenCalled();
    });

    it('should reject a deactivated key and not cache it', async () => {
      mockApiKeyService.getByHash.mockResolvedValue({
        ...stored,
        isActive: false,
      });

      await expect(strategy.validate(req())).rejects.toThrow(
        'API key has been deactivated',
      );
      expect(mockApiKeyService.cacheValidKey).not.toHaveBeenCalled();
    });

    it('should reject an unknown key', async () => {
      mockApiKeyService.getByHash.mockResolvedValue(null);

      await expect(strategy.validate(req())).rejects.toThrow('Invalid API key');
    });
  });
});
