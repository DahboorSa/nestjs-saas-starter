import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OrganizationModule } from '../organizations/organization.module';
import { UserModule } from '../users/user.module';
import { PlanModule } from '../plans/plan.module';
import { JobModule } from '../../jobs/job.module';
import { JwtStrategy, ApiKeyStrategy } from './strategies';
import { JwtGuard, RolesGuard, JwtOnlyGuard } from './guards';
import { UtilityModule } from '../../common/utils/utility.module';
import { JwtUtilityModule } from '../../common/utils/jwt-utility.module';
import { ApiKeyModule } from '../api-keys/api-key.module';
import { AuditLogModule } from '../audit-logs/audit-log.module';

@Module({
  imports: [
    OrganizationModule,
    UserModule,
    PlanModule,
    JobModule,
    UtilityModule,
    JwtUtilityModule,
    ApiKeyModule,
    AuditLogModule,
  ],
  providers: [
    AuthService,
    JwtStrategy,
    ApiKeyStrategy,
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: JwtOnlyGuard },
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
