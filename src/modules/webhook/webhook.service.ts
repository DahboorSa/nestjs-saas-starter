import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Raw, Repository } from 'typeorm';
import { WebhookEndpointEntity } from './entities/webhook-endpoint.entity';
import { AuditContextDto, UserInfoDto } from '../../common/dto';
import { randomBytes } from 'crypto';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { AuditAction, AuditResourceType, WebhookEvent } from '../../enums';
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  constructor(
    @InjectRepository(WebhookEndpointEntity)
    private readonly webhookEndpointRepository: Repository<WebhookEndpointEntity>,
    private readonly auditLogService: AuditLogService,
  ) {}

  private audit(
    auditContext: AuditContextDto,
    action: AuditAction,
    resourceId: string,
    metadata: Record<string, any>,
  ) {
    this.auditLogService
      .create({
        ...auditContext,
        action,
        resourceType: AuditResourceType.WEBHOOK,
        resourceId,
        metadata,
      })
      .catch(() => {
        this.logger.error('Failed to create audit log');
      });
  }

  private mapWebhookData(
    webhook: WebhookEndpointEntity,
  ): Partial<WebhookEndpointEntity> {
    return {
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      isActive: webhook.isActive,
      createdAt: webhook.createdAt,
    };
  }
  async findAll(
    organizationId: string,
  ): Promise<Partial<WebhookEndpointEntity>[]> {
    const webhooks = await this.webhookEndpointRepository.find({
      where: { organization: { id: organizationId }, isActive: true },
    });
    return webhooks.map((webhook) => this.mapWebhookData(webhook));
  }

  async findByIdAndEvent(
    orgId: string,
    event: WebhookEvent,
  ): Promise<Partial<WebhookEndpointEntity> | null> {
    const webhook = await this.webhookEndpointRepository.findOne({
      where: {
        organization: { id: orgId },
        isActive: true,
        events: Raw((alias) => `${alias} @> :events::jsonb`, {
          events: JSON.stringify([event]),
        }),
      },
    });

    if (!webhook) return null;
    return {
      ...this.mapWebhookData(webhook),
      secret: webhook.secret,
    };
  }
  async create(
    auditContext: AuditContextDto,
    user: UserInfoDto,
    body: CreateWebhookDto,
  ): Promise<Partial<WebhookEndpointEntity>> {
    const secret = randomBytes(32).toString('hex');
    const webhookData = this.webhookEndpointRepository.create({
      ...body,
      secret,
      organization: { id: user.orgId },
    });
    const webhook = await this.webhookEndpointRepository.save(webhookData);

    this.audit(auditContext, AuditAction.WEBHOOK_CREATED, webhook.id, {
      url: webhook.url,
      events: webhook.events,
    });
    return {
      ...this.mapWebhookData(webhook),
      secret,
    };
  }

  async getActiveWebhookEvents(organizationId: string): Promise<number> {
    return await this.webhookEndpointRepository.count({
      where: { isActive: true, organization: { id: organizationId } },
    });
  }

  async remove(
    auditContext: AuditContextDto,
    userInfo: UserInfoDto,
    id: string,
  ): Promise<Partial<WebhookEndpointEntity>> {
    const { orgId } = userInfo;
    const webhook = await this.webhookEndpointRepository.findOneBy({
      id,
      organization: { id: orgId },
    });
    if (!webhook) throw new NotFoundException('Webhook not found');
    if (!webhook.isActive)
      throw new NotFoundException('Webhook Already removed');

    await this.webhookEndpointRepository.merge(webhook, {
      isActive: false,
    });
    const webhookUpdated = await this.webhookEndpointRepository.save(webhook);

    this.audit(auditContext, AuditAction.WEBHOOK_DELETED, webhook.id, {
      url: webhook.url,
    });
    return this.mapWebhookData(webhookUpdated);
  }
}
