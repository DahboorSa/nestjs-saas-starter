import { Module } from '@nestjs/common';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookDeliveryEntity } from './entities/webhook-delivery.entity';
import { AuditLogModule } from '../audit-logs/audit-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([WebhookDeliveryEntity]), AuditLogModule],
  providers: [WebhookDeliveryService],
  controllers: [],
  exports: [WebhookDeliveryService],
})
export class WebhookDeliveryModule {}
