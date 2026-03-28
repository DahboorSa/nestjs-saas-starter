import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ApiKeyEntity } from './entities/api-key.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { OrganizationService } from '../organizations/organization.service';
import { AuditContextDto, UserInfoDto } from '../../common/dto';
import { CacheService } from '../../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { AuditAction, AuditResourceType, WebhookEvent } from '../../enums';
import { WebhookDispatcherService } from '../webhook-dispatchers/webhook-dispatcher.service';
import { CreateApiKeyDto } from './dto';

export interface ReturnApiKey extends Partial<ApiKeyEntity> {
  message: string;
  apiKey: string;
}

export interface ApiKeyResponse extends Partial<ApiKeyEntity> {
  id: number;
  name: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  createdAt: Date;
  lastUsedAt: Date;
  orgId: string;
}

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);
  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly apiKeyRepository: Repository<ApiKeyEntity>,
    private readonly organizationService: OrganizationService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
    private readonly dispatcher: WebhookDispatcherService,
  ) {}

  private auditAndDispatch(
    auditContext: AuditContextDto,
    action: AuditAction,
    webhookEvent: WebhookEvent,
    orgId: string,
    apiKey: ApiKeyEntity,
    webhookPayload: Record<string, any>,
    organization?: ApiKeyEntity['organization'],
  ) {
    this.auditLogService
      .create({
        ...auditContext,
        action,
        resourceType: AuditResourceType.API_KEY,
        resourceId: apiKey.id.toString(),
        apiKey,
        ...(organization && { organization }),
      })
      .catch(() => {
        this.logger.error('Failed to create audit log');
      });
    this.dispatcher
      .dispatch(orgId, webhookEvent, webhookPayload)
      .catch((error) => {
        this.logger.error('Error dispatching webhook', error);
      });
  }

  private mapApiKeyData(key: ApiKeyEntity): Partial<ApiKeyResponse> {
    return {
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes,
      isActive: key.isActive,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      orgId: key.organization?.id,
    };
  }

  hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  async getByHash(hash: string): Promise<Partial<ApiKeyResponse>> {
    const key = await this.apiKeyRepository.findOne({
      where: { keyHash: hash },
      relations: ['organization'],
    });
    if (!key) return null;
    return this.mapApiKeyData(key);
  }

  async getByOrgId(orgId: string): Promise<Partial<ApiKeyResponse>[]> {
    const organization = await this.organizationService.getById(orgId);
    if (!organization) throw new NotFoundException('Organization not found');
    if (!organization.isActive)
      throw new NotFoundException('Organization not active');
    const listOfKeys = await this.apiKeyRepository.find({
      where: {
        organization: { id: organization.id },
        isActive: true,
      },
    });
    return listOfKeys.map((key) => this.mapApiKeyData(key));
  }
  async create(
    auditContext: AuditContextDto,
    userInfo: UserInfoDto,
    body: CreateApiKeyDto,
  ): Promise<ReturnApiKey> {
    const organization = await this.organizationService.getDetails(userInfo);
    if (!organization) throw new NotFoundException('Organization not found');
    if (!organization.isActive)
      throw new NotFoundException('Organization not active');
    const { plan } = organization;
    const { maxApiKeys } = plan?.limits;
    const totalActiveKeys = await this.apiKeyRepository.count({
      where: {
        organization: { id: organization.id },
        isActive: true,
      },
    });
    if (maxApiKeys !== -1 && totalActiveKeys >= maxApiKeys)
      throw new ForbiddenException('Maximum number of API keys reached');
    const apiKey = `${this.configService.get<string>('API_KEY_PREFIX')}${randomBytes(32).toString('hex')}`;
    const hashedApiKey = this.hashKey(apiKey);
    const keyPrefix = apiKey.slice(0, 12);
    const payload: Partial<ApiKeyEntity> = {
      ...body,
      keyPrefix,
      keyHash: hashedApiKey,
      organization,
    };
    const apiKeyInfo = await this.apiKeyRepository.create(payload);
    await this.apiKeyRepository.save(apiKeyInfo);
    await this.cacheService.set(
      `apikey:valid:${hashedApiKey}`,
      JSON.stringify({
        ...body,
        orgId: organization.id,
      }),
      +this.configService.get('API_KEY_EXPIRATION'),
    );
    this.auditAndDispatch(
      auditContext,
      AuditAction.API_KEY_CREATED,
      WebhookEvent.API_KEY_CREATED,
      userInfo.orgId,
      apiKeyInfo,
      { keyPrefix, name: body.name },
      organization,
    );
    return {
      message: 'Save this key — it will never be shown again !!',
      ...body,
      keyPrefix,
      apiKey,
    };
  }

  async remove(
    auditContext: AuditContextDto,
    userInfo: UserInfoDto,
    id: number,
  ): Promise<Partial<ApiKeyResponse>> {
    const { orgId } = userInfo;
    const apiKey = await this.apiKeyRepository.findOneBy({
      id,
      organization: { id: orgId },
    });
    if (!apiKey) throw new NotFoundException('API key not found');
    if (!apiKey.isActive)
      throw new NotFoundException('API key Already removed');

    await this.apiKeyRepository.merge(apiKey, {
      isActive: false,
    });

    const keyUpdated = await this.apiKeyRepository.save(apiKey);
    const hashedApiKey = keyUpdated.keyHash;
    await this.cacheService.delete(`apikey:valid:${hashedApiKey}`);
    this.auditAndDispatch(
      auditContext,
      AuditAction.API_KEY_REVOKED,
      WebhookEvent.API_KEY_REVOKED,
      userInfo.orgId,
      keyUpdated,
      { keyPrefix: keyUpdated.keyPrefix, name: keyUpdated.name },
    );
    return this.mapApiKeyData(keyUpdated);
  }
}
