import { Module } from '@nestjs/common';
import { UsageSyncScheduler } from '../schedulers/usage-sync.scheduler';
import { UsageResetScheduler } from '../schedulers/usage-reset.scheduler';
import { InvitationModule } from '../../modules/invitations/invitation.module';
import { ScheduleModule } from '@nestjs/schedule';
import { UsageRecordModule } from '../../modules/usage-records/usage-record.module';
import { TrialExpiryScheduler } from './trial-expiry.scheduler';
import { OrganizationModule } from '../../modules/organizations/organization.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    UsageRecordModule,
    InvitationModule,
    OrganizationModule,
  ],
  providers: [UsageSyncScheduler, UsageResetScheduler, TrialExpiryScheduler],
  controllers: [],
  exports: [],
})
export class SchedulerModule {}
