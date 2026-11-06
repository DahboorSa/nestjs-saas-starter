import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import {
  ApiKeyService,
  CachedApiKey,
  apiKeyCacheKey,
} from '../../../modules/api-keys/api-key.service';
import { CacheService } from '../../../cache/cache.service';
import { logError } from '../../../common/utils/log-error.util';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  private readonly logger = new Logger(ApiKeyStrategy.name);

  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  private assertNotExpired(expiresAt?: Date | string | null) {
    if (expiresAt && new Date(expiresAt) < new Date())
      throw new UnauthorizedException('API key has expired');
  }

  async validate(req: Request) {
    const authHeader = req?.headers?.['authorization'];
    if (!authHeader) return null;

    const token = authHeader?.split(' ')?.[1] as string;
    if (
      !token ||
      !token.startsWith(this.configService.getOrThrow<string>('API_KEY_PREFIX'))
    ) {
      return null;
    }

    const sha256Hash = this.apiKeyService.hashKey(token);

    const cached = await this.cacheService.get(apiKeyCacheKey(sha256Hash));
    if (cached) {
      const payload: CachedApiKey | null = JSON.parse(cached);
      if (payload) {
        this.assertNotExpired(payload.expiresAt);
        this.apiKeyService.markUsed(payload.id);
        return {
          orgId: payload.orgId,
          scopes: payload.scopes,
          isApiKey: true,
        };
      }
    }

    const apiKey = await this.apiKeyService.getByHash(sha256Hash);
    if (!apiKey) throw new UnauthorizedException('Invalid API key');
    if (!apiKey.isActive)
      throw new UnauthorizedException('API key has been deactivated');
    this.assertNotExpired(apiKey.expiresAt);

    // Refill the cache so the next requests skip the database. Only a key that
    // passed every check above gets here, and revoking deletes this entry.
    if (apiKey.id !== undefined && apiKey.orgId && apiKey.scopes) {
      this.apiKeyService.markUsed(apiKey.id);
      await this.apiKeyService
        .cacheValidKey(sha256Hash, {
          id: apiKey.id,
          orgId: apiKey.orgId,
          scopes: apiKey.scopes,
          expiresAt: apiKey.expiresAt ?? null,
        })
        .catch((error) => {
          logError(this.logger, 'Error caching API key', error);
        });
    }
    return {
      orgId: apiKey?.orgId,
      scopes: apiKey?.scopes,
      isApiKey: true,
    };
  }
}
