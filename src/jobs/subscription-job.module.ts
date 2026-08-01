import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { SubscriptionProcessor } from './processors/subscription.process';
import { SubscriptionQueueService } from './queues/subscription.queue';
import { BillingModule } from '../modules/billing/billing.module';

@Module({
  imports: [
    BillingModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST'),
          port: config.get<number>('REDIS_PORT'),
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'subscriptionQueue',
    }),
  ],
  providers: [SubscriptionProcessor, SubscriptionQueueService],
  controllers: [],
  exports: [SubscriptionQueueService],
})
export class SubscriptionJobModule {}
