import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { OrganizationEntity } from './entities/organization.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UtilityModule } from '../../common/utils/utility.module';
import { UserModule } from '../users/user.module';
import { AuditLogModule } from '../audit-logs/audit-log.module';
import { WebhookDispatcherModule } from '../webhook-dispatchers/webhook-dispatcher.module';
import { PlanModule } from '../plans/plan.module';
import { StripeCoreModule } from '../stripe/stripe-core.module';

@Module({
  imports: [
    StripeCoreModule,
    TypeOrmModule.forFeature([OrganizationEntity]),
    UtilityModule,
    UserModule,
    AuditLogModule,
    WebhookDispatcherModule,
    PlanModule,
  ],
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
