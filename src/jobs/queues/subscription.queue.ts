import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';

@Injectable()
export class SubscriptionQueueService {
  constructor(
    @InjectQueue('subscriptionQueue') private subscriptionQueue: Queue,
  ) {}

  async add(consumerName: string, data: any) {
    await this.subscriptionQueue.add(consumerName, data, {
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
