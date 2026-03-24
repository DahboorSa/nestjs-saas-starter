import { Module } from '@nestjs/common';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyService } from './api-key.service';
import { ApiKeyEntity } from './entities/api-key.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationModule } from '../organizations/organization.module';
import { AuditLogModule } from '../audit-logs/audit-log.module';
import { WebhookDispatcherModule } from '../webhook-dispatchers/webhook-dispatcher.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKeyEntity]),
    OrganizationModule,
    AuditLogModule,
    WebhookDispatcherModule,
  ],
  controllers: [ApiKeyController],
  providers: [ApiKeyService],
  exports: [ApiKeyService],
})
export class ApiKeyModule {}
