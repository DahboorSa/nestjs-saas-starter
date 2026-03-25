import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { ConfigService } from '@nestjs/config';

const mockRedis = {
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  flushall: jest.fn(),
  flushdb: jest.fn(),
  incr: jest.fn(),
  scan: jest.fn(),
};

jest.mock('ioredis', () => ({
  Redis: jest.fn().mockImplementation(() => mockRedis),
}));

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'REDIS_HOST') return 'localhost';
    if (key === 'REDIS_PORT') return 6379;
  }),
};

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('set', () => {
    it('should set a value with TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.set('key', 'value', 3600);

      expect(mockRedis.set).toHaveBeenCalledWith('key', 'value', 'EX', 3600);
    });

    it('should set a value without TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.set('key', 'value');

      expect(mockRedis.set).toHaveBeenCalledWith('key', 'value');
    });
  });

  describe('get', () => {
    it('should return the value for a key', async () => {
      mockRedis.get.mockResolvedValue('stored-value');

      const result = await service.get('key');

      expect(result).toBe('stored-value');
      expect(mockRedis.get).toHaveBeenCalledWith('key');
    });

    it('should return null if key does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.get('missing-key');

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a key', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.delete('key');

      expect(mockRedis.del).toHaveBeenCalledWith('key');
    });
  });

  describe('flushAll', () => {
    it('should flush all Redis databases', async () => {
      mockRedis.flushall.mockResolvedValue('OK');

      await service.flushAll();

      expect(mockRedis.flushall).toHaveBeenCalled();
    });
  });

  describe('flush', () => {
    it('should flush the current Redis database', async () => {
      mockRedis.flushdb.mockResolvedValue('OK');

      await service.flush();

      expect(mockRedis.flushdb).toHaveBeenCalled();
    });
  });

  describe('incr', () => {
    it('should increment a key and return the new value', async () => {
      mockRedis.incr.mockResolvedValue(5);

      const result = await service.incr('counter');

      expect(result).toBe(5);
      expect(mockRedis.incr).toHaveBeenCalledWith('counter');
    });
  });

  describe('getByPattern', () => {
    it('should return all keys matching the pattern in a single scan', async () => {
      mockRedis.scan.mockResolvedValue(['0', ['key:1', 'key:2']]);

      const result = await service.getByPattern('key:*');

      expect(result).toEqual(['key:1', 'key:2']);
      expect(mockRedis.scan).toHaveBeenCalledTimes(1);
    });

    it('should paginate through multiple scan iterations', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['42', ['key:1']])
        .mockResolvedValueOnce(['0', ['key:2', 'key:3']]);

      const result = await service.getByPattern('key:*');

      expect(result).toEqual(['key:1', 'key:2', 'key:3']);
      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
    });

    it('should return empty array if no keys match', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);

      const result = await service.getByPattern('nonexistent:*');

      expect(result).toEqual([]);
    });
  });

  describe('deleteByPattern', () => {
    it('should delete all keys matching the pattern', async () => {
      mockRedis.scan.mockResolvedValue(['0', ['key:1', 'key:2']]);
      mockRedis.del.mockResolvedValue(2);

      await service.deleteByPattern('key:*');

      expect(mockRedis.del).toHaveBeenCalledWith('key:1', 'key:2');
    });

    it('should paginate and delete across multiple scan iterations', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['42', ['key:1']])
        .mockResolvedValueOnce(['0', ['key:2']]);
      mockRedis.del.mockResolvedValue(1);

      await service.deleteByPattern('key:*');

      expect(mockRedis.del).toHaveBeenCalledTimes(2);
    });

    it('should not call del if no keys match', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);

      await service.deleteByPattern('nonexistent:*');

      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });
});
