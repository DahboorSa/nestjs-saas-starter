import { Module } from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvitationEntity } from './entities/invitation.entity';
import { InvitationController } from './invitation.controller';
import { JobModule } from '../../jobs/job.module';
import { UserModule } from '../users/user.module';
import { OrganizationModule } from '../organizations/organization.module';
import { JwtUtilityModule } from '../../common/utils/jwt-utility.module';
import { AuditLogModule } from '../audit-logs/audit-log.module';
import { WebhookDispatcherModule } from '../webhook-dispatchers/webhook-dispatcher.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([InvitationEntity]),
    UserModule,
    OrganizationModule,
    JobModule,
    JwtUtilityModule,
    AuditLogModule,
    WebhookDispatcherModule,
  ],
  providers: [InvitationService],
  controllers: [InvitationController],
  exports: [InvitationService],
})
export class InvitationModule {}
