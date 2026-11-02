import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { SubscriptionJobData } from '../job-data.types';

@Injectable()
export class SubscriptionQueueService {
  constructor(
    @InjectQueue('subscriptionQueue') private subscriptionQueue: Queue,
  ) {}

  async add(consumerName: string, data: SubscriptionJobData) {
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
