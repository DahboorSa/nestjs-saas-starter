import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import databaseConfig from './config/database.config';
import JwtConfig from './config/jwt.config';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationModule } from './modules/organizations/organization.module';
import { PlanModule } from './modules/plans/plan.module';
import { InvitationModule } from './modules/invitations/invitation.module';
import { ApiKeyModule } from './modules/api-keys/api-key.module';
import { UsageModule } from './modules/usage/usage.module';
import { CacheModule } from './cache/cache.module';
import { AuditLogEntity } from './modules/audit-logs/entities/audit-log.entity';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { UsageTrackerInterceptor } from './common/interceptors/usage-tracker.interceptor';
import { UtilityService } from './common/utils/utility.service';
import { AuditLogService } from './modules/audit-logs/audit-log.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookModule } from './modules/webhook/webhook.module';
import { SchedulerModule } from './jobs/schedulers/scheduler.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      load: [databaseConfig, JwtConfig],
    }),
    TypeOrmModule.forFeature([AuditLogEntity]),
    CacheModule,
    DatabaseModule,
    AuthModule,
    PassportModule,
    OrganizationModule,
    PlanModule,
    InvitationModule,
    ApiKeyModule,
    UsageModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'api',
            ttl: config.get<number>('THROTTLER_TTL'),
            limit: config.get<number>('THROTTLER_LIMIT'),
          },
          {
            name: 'auth',
            ttl: config.get<number>('THROTTLER_TTL'),
            limit: config.get<number>('THROTTLER_AUTH_LIMIT'),
          },
        ],
      }),
    }),
    WebhookModule,
    SchedulerModule,
  ],
  controllers: [],
  providers: [
    Reflector,
    UtilityService,
    AuditLogService,
    {
      provide: APP_INTERCEPTOR,
      useClass: UsageTrackerInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
