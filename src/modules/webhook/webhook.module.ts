import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookEndpointEntity } from './entities/webhook-endpoint.entity';
import { UsageModule } from '../usage/usage.module';
import { AuditLogModule } from '../audit-logs/audit-log.module';
import { JobModule } from '../../jobs/job.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookEndpointEntity]),
    UsageModule,
    AuditLogModule,
    JobModule,
  ],
  providers: [WebhookService],
  controllers: [WebhookController],
})
export class WebhookModule {}
