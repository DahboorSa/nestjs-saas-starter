import { Module } from '@nestjs/common';
import { UsageSyncScheduler } from '../schedulers/usage-sync.scheduler';
import { UsageResetScheduler } from '../schedulers/usage-reset.scheduler';
import { InvitationModule } from '../../modules/invitations/invitation.module';
import { ScheduleModule } from '@nestjs/schedule';
import { UsageRecordModule } from '../../modules/usage-records/usage-record.module';

@Module({
  imports: [ScheduleModule.forRoot(), UsageRecordModule, InvitationModule],
  providers: [UsageSyncScheduler, UsageResetScheduler],
  controllers: [],
  exports: [],
})
export class SchedulerModule {}
