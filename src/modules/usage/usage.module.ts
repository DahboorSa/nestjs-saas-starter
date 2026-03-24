import { Module } from '@nestjs/common';
import { UsageService } from './usage.service';
import { OrganizationEntity } from '../organizations/entities/organization.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookDispatcherModule } from '../webhook-dispatchers/webhook-dispatcher.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrganizationEntity]),
    WebhookDispatcherModule,
  ],
  controllers: [],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
