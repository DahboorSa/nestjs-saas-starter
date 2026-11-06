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

  async set(key: string, value: string | number | boolean, ttl?: number) {
    const stored = typeof value === 'boolean' ? String(value) : value;
    if (ttl) return this.redis.set(key, stored, 'EX', ttl);
    return this.redis.set(key, stored);
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  // True only for the caller that created the key, so a burst of requests
  // lets exactly one of them through.
  async setIfAbsent(key: string, value: string, ttl: number): Promise<boolean> {
    return (await this.redis.set(key, value, 'EX', ttl, 'NX')) === 'OK';
  }

  async delete(key: string) {
    return this.redis.del(key);
  }

  async flushAll() {
    return this.redis.flushall();
  }

  async flush() {
    return this.redis.flushdb();
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
