import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';

@Injectable()
export class EmailQueueService {
  constructor(@InjectQueue('emailQueue') private emailQueue: Queue) {}

  async add(consumerName: string, data: any) {
    await this.emailQueue.add(consumerName, data, {
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
