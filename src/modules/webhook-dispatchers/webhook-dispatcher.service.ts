import { Injectable, Logger } from '@nestjs/common';
import { WebhookEvent } from '../../enums';
import { WebhookQueueService } from '../../jobs/queues/webhook.queue';
import { InjectRepository } from '@nestjs/typeorm';
import { Raw, Repository } from 'typeorm';
import { WebhookEndpointEntity } from '../webhook/entities/webhook-endpoint.entity';

@Injectable()
export class WebhookDispatcherService {
  private readonly logger = new Logger(WebhookDispatcherService.name);
  constructor(
    @InjectRepository(WebhookEndpointEntity)
    private readonly webhookEndpointRepository: Repository<WebhookEndpointEntity>,
    private readonly webhookQueue: WebhookQueueService,
  ) {}

  async dispatch(orgId: string, event: WebhookEvent, payload: any) {
    const webhookRecords = await this.webhookEndpointRepository.find({
      where: {
        organization: { id: orgId },
        isActive: true,
        events: Raw((alias) => `${alias} @> :events::jsonb`, {
          events: JSON.stringify([event]),
        }),
      },
    });
    webhookRecords.forEach((webhookRecord) => {
      this.logger.debug(`Dispatching webhook ${webhookRecord.id}`, event);
      this.webhookQueue.add({
        orgId,
        webhookEndpointId: webhookRecord.id,
        url: webhookRecord.url,
        secret: webhookRecord.secret,
        event,
        payload,
      });
      this.logger.debug(`Dispatched webhook ${webhookRecord.id}`, event);
    });
  }
}
