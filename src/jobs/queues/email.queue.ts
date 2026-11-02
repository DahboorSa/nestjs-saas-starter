import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';

const EMAIL_FAILED_JOB_RETENTION_SECONDS = 24 * 60 * 60;

@Injectable()
export class EmailQueueService {
  constructor(@InjectQueue('emailQueue') private emailQueue: Queue) {}

  async add(consumerName: string, data: any) {
    await this.emailQueue.add(consumerName, data, {
      removeOnComplete: true,
      // Job data holds the raw email token. Keep failed jobs for debugging, but
      // no longer than the shortest token TTL (TTL_EXPIRATION, 24h) so a dead
      // email provider can't leave live tokens in Redis forever.
      removeOnFail: { age: EMAIL_FAILED_JOB_RETENTION_SECONDS, count: 1000 },
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  }
}
