import { Module } from '@nestjs/common';
import { EmailQueueService } from './queues/email.queue';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { WebhookQueueService } from './queues/webhook.queue';
import { WebhookProcessor } from './processors/webhook.processor';
import { EmailProcessor } from './processors/email.processor';
import { WebhookDeliveryModule } from '../modules/webhook-deliveries/webhook-delivery.module';

@Module({
  imports: [
    WebhookDeliveryModule,
    HttpModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST'),
          port: config.get<number>('REDIS_PORT'),
        },
      }),
    }),
    BullModule.registerQueue(
      {
        name: 'emailQueue',
      },
      {
        name: 'webhookQueue',
      },
    ),
  ],
  providers: [
    EmailQueueService,
    EmailProcessor,
    WebhookQueueService,
    WebhookProcessor,
  ],
  controllers: [],
  exports: [EmailQueueService, WebhookQueueService],
})
export class JobModule {}
