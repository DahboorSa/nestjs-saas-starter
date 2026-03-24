import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, map, Observable, switchMap } from 'rxjs';
import { IS_PUBLIC_KEY } from '../../modules/auth/decorator';
import { UsageService } from '../../modules/usage/usage.service';
import { UtilityService } from '../utils/utility.service';
import { AuditAction, AuditResourceType, UsageMetric } from '../../enums';
import { AuditLogService } from '../../modules/audit-logs/audit-log.service';

@Injectable()
export class UsageTrackerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(UsageTrackerInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly usageService: UsageService,
    private readonly utilityService: UtilityService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async logUsage(contextInfo: any): Promise<void> {
    const { orgId, userId } = contextInfo.user;
    const period = this.utilityService.formatYYMM(new Date());
    const count = await this.usageService.incrementUsage(
      orgId,
      UsageMetric.API_CALLS,
      period,
    );
    const { planId, apiCallsPerMonth: limit } =
      await this.usageService.getPlanLimit(orgId);
    if (limit !== -1 && count >= limit) {
      const ttl = this.utilityService.getEndOfMonthTTL();
      await this.usageService.setLimitExceeded(orgId, ttl, {
        limit,
        current: count,
        period,
      });
      this.auditLogService
        .create({
          action: AuditAction.PLAN_LIMIT_EXCEEDED,
          resourceType: AuditResourceType.PLAN,
          resourceId: planId.toString(),
          ipAddress: contextInfo.ip,
          userAgent: contextInfo.headers?.['user-agent'] ?? null,
          metadata: {
            orgId,
            userId,
          },
        })
        .catch((error) =>
          this.logger.error('Failed to create audit log', error),
        );
    }
  }
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const isPublic = this.reflector.getAllAndOverride(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const contextInfo = context.switchToHttp().getRequest();
    if (isPublic) {
      this.logger.log(
        `skipping usage tracker for public route: [${contextInfo.method}] ${contextInfo.url}`,
      );
      return next.handle();
    }
    const { orgId } = contextInfo.user;
    return from(this.usageService.isLimitExceeded(orgId)).pipe(
      switchMap((isLimitExceeded) => {
        if (isLimitExceeded) {
          this.logger.error(
            `Monthly API limit exceeded for orgId: ${orgId} using route: [${contextInfo.method}] ${contextInfo.url}`,
          );
          throw new ConflictException('Monthly API limit exceeded');
        }
        return next
          .handle()
          .pipe(
            switchMap((data) =>
              from(this.logUsage(contextInfo)).pipe(map(() => data)),
            ),
          );
      }),
    );
  }
}
