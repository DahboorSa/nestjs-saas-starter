import {
  CallHandler,
  ForbiddenException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { from, Observable, switchMap } from 'rxjs';
import { OrganizationService } from '../../organizations/organization.service';

@Injectable()
export class MemberInviteTrackerInterceptor implements NestInterceptor {
  constructor(private readonly organizationService: OrganizationService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();

    const batchSize = Array.isArray(req.body) ? req.body.length : 1;

    return from(this.organizationService.getMemberLimitInfo(req.user)).pipe(
      switchMap(({ plan, count }) => {
        const limit = plan.limits.maxMembers ?? -1;
        if (limit !== -1 && count + batchSize > limit) {
          throw new ForbiddenException('Member limit reached');
        }
        return next.handle();
      }),
    );
  }
}
