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
  async process(job: Job<any>) {
    const { data, name, id, attemptsMade } = job;
    this.logger.log(`Processing job ${id} of type ${name}`, data);
    const { orgId, webhookEndpointId, event, url, secret } = data;
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

      await this.webhookDeliveryService.create(webhookEndpointId, orgId, {
        event,
        payload: data.payload,
        status: DeliveryStatus.SUCCESS,
        statusCode: response.status,
        attempt: attemptsMade,
      });
      this.logger.log(`Processed job ${id} of type ${name}`, data);
    } catch (error) {
      const statusCode = isAxiosError(error)
        ? (error.response?.status ?? null)
        : null;
      await this.webhookDeliveryService.create(webhookEndpointId, orgId, {
        event,
        payload: data.payload,
        status: DeliveryStatus.FAILED,
        statusCode,
        attempt: attemptsMade,
      });
      this.logger.error(error);
      if (statusCode === 404) {
        this.logger.log(`Endpoint not found for job ${job.id}, skipping retry`);
        return;
      }
      if (attemptsMade > 4) {
        this.logger.log(
          `Max attempts exceeded for job ${job.id}, skipping retry`,
        );
        return;
      }
      throw error;
    }
  }
}
