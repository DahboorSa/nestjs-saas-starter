import { Module } from '@nestjs/common';
import { UsageService } from './usage.service';
import { UsageController } from './usage.controller';
import { OrganizationEntity } from '../organizations/entities/organization.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookDispatcherModule } from '../webhook-dispatchers/webhook-dispatcher.module';
import { UtilityModule } from '../../common/utils/utility.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrganizationEntity]),
    WebhookDispatcherModule,
    UtilityModule,
  ],
  controllers: [UsageController],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
