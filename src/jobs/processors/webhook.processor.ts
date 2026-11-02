import { logError } from '../../common/utils/log-error.util';
import { WebhookJobData } from '../job-data.types';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { createHmac, randomUUID } from 'crypto';
import { HttpService } from '@nestjs/axios';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { WebhookDeliveryService } from '../../modules/webhook-deliveries/webhook-delivery.service';
import { DeliveryStatus } from '../../enums';

@Processor('webhookQueue')
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);
  constructor(
    private readonly httpService: HttpService,
    private readonly webhookDeliveryService: WebhookDeliveryService,
  ) {
    super();
  }
  private signPayload(
    secret: string,
    timestamp: number,
    payload: object,
  ): string {
    const jsonString = JSON.stringify(payload);

    const message = `${timestamp}.${jsonString}`;

    const signature = createHmac('sha256', secret)
      .update(message)
      .digest('hex');

    return `sha256=${signature}`;
  }
  async process(job: Job<WebhookJobData>) {
    const { data, name, id, attemptsMade } = job;
    const { orgId, webhookEndpointId, event, url, secret } = data;
    // Never log `data` itself: it carries the endpoint secret, URL and payload.
    this.logger.log(
      `Processing job ${id} of type ${name} (endpoint ${webhookEndpointId}, event ${event})`,
    );

    // One delivery row per job: created PENDING on the first attempt, then
    // updated in place on every retry. The id is persisted on the job so a
    // retry (possibly on another worker) reuses the same row.
    let deliveryId = data.deliveryId;
    if (!deliveryId) {
      deliveryId = await this.webhookDeliveryService.createPending(
        webhookEndpointId,
        { event, payload: data.payload },
      );
      await job.updateData({ ...data, deliveryId });
    }

    try {
      const timestamp = Date.now();
      const payload = {
        id: webhookEndpointId,
        event,
        timestamp,
        data: data.payload,
      };
      const hmacHex = this.signPayload(secret, timestamp, payload);
      const headers = {
        'X-Webhook-Signature': hmacHex,
        'X-Webhook-Timestamp': timestamp,
        'X-Webhook-Delivery': randomUUID(),
        'X-Webhook-Event': event,
      };
      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          timeout: 5000,
          headers,
        }),
      );

      await this.webhookDeliveryService.recordAttempt(deliveryId, orgId, {
        status: DeliveryStatus.SUCCESS,
        statusCode: response.status,
        attempt: attemptsMade,
      });
      this.logger.log(`Processed job ${id} of type ${name}`);
    } catch (error) {
      const statusCode = isAxiosError(error)
        ? (error.response?.status ?? null)
        : null;
      // logError, not the raw error: an AxiosError's `config` holds the URL,
      // signature header and request body.
      logError(
        this.logger,
        `Webhook delivery failed for job ${id} (endpoint ${webhookEndpointId})${statusCode ? ` [HTTP ${statusCode}]` : ''}`,
        error,
      );

      const maxAttempts = job.opts.attempts ?? 1;
      const noRetry = statusCode === 404;
      const isLastAttempt = attemptsMade + 1 >= maxAttempts;
      const isFinal = noRetry || isLastAttempt;

      await this.webhookDeliveryService.recordAttempt(deliveryId, orgId, {
        status: isFinal ? DeliveryStatus.FAILED : DeliveryStatus.PENDING,
        statusCode,
        attempt: attemptsMade,
      });

      if (noRetry) {
        this.logger.log(`Endpoint not found for job ${job.id}, skipping retry`);
        return;
      }
      throw error;
    }
  }
}
