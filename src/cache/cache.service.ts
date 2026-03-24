import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
@Injectable()
export class CacheService {
  private readonly redis;
  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST'),
      port: this.configService.get<number>('REDIS_PORT'),
    });
  }

  async set(key: string, value: any, ttl?: number) {
    if (ttl) return this.redis.set(key, value, 'EX', ttl);
    return this.redis.set(key, value);
  }

  async get(key: string): Promise<any> {
    return this.redis.get(key);
  }

  async delete(key: string) {
    return this.redis.del(key);
  }

  async flushAll() {
    return this.redis.flushall(); // all db in redis server
  }

  async flush() {
    return this.redis.flushdb(); // current db
  }

  async incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  async getByPattern(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');
    return keys;
  }

  async deleteByPattern(pattern: string): Promise<void> {
    let cursor = '0';
    do {
      const [nextCursor, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      if (batch.length > 0) await this.redis.del(...batch);
    } while (cursor !== '0');
  }
}
