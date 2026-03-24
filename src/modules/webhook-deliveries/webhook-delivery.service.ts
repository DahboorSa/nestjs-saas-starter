import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { WebhookDeliveryEntity } from './entities/webhook-delivery.entity';
import { AuditAction, AuditResourceType } from '../../enums';
import { OrganizationEntity } from '../organizations/entities/organization.entity';
@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);
  constructor(
    @InjectRepository(WebhookDeliveryEntity)
    private readonly webhookDeliveryRepository: Repository<WebhookDeliveryEntity>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(
    webhookEndpointId: string,
    organizationId: string,
    body: Partial<WebhookDeliveryEntity>,
  ) {
    const webhookData = this.webhookDeliveryRepository.create({
      ...body,
    });
    const webhook = await this.webhookDeliveryRepository.save({
      ...webhookData,
      webhookEndpoint: {
        id: webhookEndpointId,
      },
    });

    this.auditLogService
      .create({
        ipAddress: '::1',
        userAgent: 'webhook-delivery',
        action: AuditAction.WEBHOOK_DELIVERED,
        resourceType: AuditResourceType.WEBHOOK,
        resourceId: webhook.id,
        metadata: {
          payload: body.payload,
        },
        organization: { id: organizationId } as OrganizationEntity,
      })
      .catch(() => {
        this.logger.error('Failed to create audit log');
      });
  }
}
