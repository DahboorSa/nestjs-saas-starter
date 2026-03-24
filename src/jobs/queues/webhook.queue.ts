import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';

@Injectable()
export class WebhookQueueService {
  constructor(@InjectQueue('webhookQueue') private webhookQueue: Queue) {}

  async add(data: any) {
    await this.webhookQueue.add('deliver-webhook', data, {
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  }
}
