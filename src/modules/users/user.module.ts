import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserEntity } from './entities/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../audit-logs/audit-log.module';
import { WebhookDispatcherModule } from '../webhook-dispatchers/webhook-dispatcher.module';
import { UserController } from './user.controller';
import { ConfigModule } from '@nestjs/config';
import { JobModule } from '../../jobs/job.module';
import { JwtUtilityModule } from '../../common/utils/jwt-utility.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    JwtUtilityModule,
    ConfigModule,
    JobModule,
    AuditLogModule,
    WebhookDispatcherModule,
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
