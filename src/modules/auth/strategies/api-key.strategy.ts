import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { ApiKeyService } from '../../../modules/api-keys/api-key.service';
import { CacheService } from '../../../cache/cache.service';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async validate(req: Request) {
    const authHeader = req?.headers?.['authorization'];
    if (!authHeader) return null;

    const token = authHeader?.split(' ')?.[1] as string;
    if (
      !token ||
      !token.startsWith(this.configService.get<string>('API_KEY_PREFIX'))
    ) {
      return null;
    }

    const sha256Hash = this.apiKeyService.hashKey(token);

    const cached = await this.cacheService.get(`apikey:valid:${sha256Hash}`);
    if (cached) {
      const payload = JSON.parse(cached);
      if (payload) {
        this.apiKeyService.updateLastUsed(payload.id).catch(() => {});
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
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date())
      throw new UnauthorizedException('API key has expired');
    this.apiKeyService.updateLastUsed(apiKey.id).catch(() => {});
    return {
      orgId: apiKey?.orgId,
      scopes: apiKey?.scopes,
      isApiKey: true,
    };
  }
}
