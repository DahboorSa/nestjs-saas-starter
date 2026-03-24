import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import { JobModule } from '../../jobs/job.module';
import { WebhookEndpointEntity } from '../webhook/entities/webhook-endpoint.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WebhookEndpointEntity]), JobModule],
  providers: [WebhookDispatcherService],
  controllers: [],
  exports: [WebhookDispatcherService],
})
export class WebhookDispatcherModule {}
