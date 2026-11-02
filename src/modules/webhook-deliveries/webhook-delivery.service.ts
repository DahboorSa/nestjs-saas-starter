import { logError } from '../../common/utils/log-error.util';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { WebhookDeliveryEntity } from './entities/webhook-delivery.entity';
import { AuditAction, AuditResourceType, DeliveryStatus } from '../../enums';
import { OrganizationEntity } from '../organizations/entities/organization.entity';
@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);
  constructor(
    @InjectRepository(WebhookDeliveryEntity)
    private readonly webhookDeliveryRepository: Repository<WebhookDeliveryEntity>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createPending(
    webhookEndpointId: string,
    body: Pick<WebhookDeliveryEntity, 'event' | 'payload'>,
  ): Promise<string> {
    const delivery = await this.webhookDeliveryRepository.save({
      ...body,
      attempt: 0,
      statusCode: null,
      status: DeliveryStatus.PENDING,
      webhookEndpoint: { id: webhookEndpointId },
    });
    return delivery.id;
  }

  async recordAttempt(
    id: string,
    organizationId: string,
    result: Pick<WebhookDeliveryEntity, 'status' | 'statusCode' | 'attempt'>,
  ) {
    await this.webhookDeliveryRepository.update(id, result);

    if (result.status !== DeliveryStatus.SUCCESS) return;

    const delivery = await this.webhookDeliveryRepository.findOneBy({ id });
    this.auditLogService
      .create({
        ipAddress: '::1',
        userAgent: 'webhook-delivery',
        action: AuditAction.WEBHOOK_DELIVERED,
        resourceType: AuditResourceType.WEBHOOK,
        resourceId: id,
        metadata: {
          payload: delivery?.payload,
        },
        organization: { id: organizationId } as OrganizationEntity,
      })
      .catch((error) => {
        logError(this.logger, 'Failed to create audit log', error);
      });
  }
}
