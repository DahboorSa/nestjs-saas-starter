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

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();

    return from(this.organizationService.getMemberLimitInfo(req.user)).pipe(
      switchMap(({ plan, count }) => {
        const limit = plan.limits.maxMembers ?? -1;
        if (limit !== -1 && count >= limit) {
          throw new ForbiddenException('Member limit reached');
        }
        return next.handle();
      }),
    );
  }
}
/**
 * returns an Observable because:
 * Nest’s internal HTTP pipeline is reactive
 * Interceptors can transform the stream
 * Multiple interceptors can chain together
 * Errors can be handled reactively
 * Streaming responses are supported (SSE, websockets, etc.)
 * So returning an Observable keeps everything in the same reactive ecosystem.
 * 
 * returns an Observable because:
Nest’s internal HTTP pipeline is reactive
Interceptors can transform the stream
Multiple interceptors can chain together
Errors can be handled reactively
Streaming responses are supported (SSE, websockets, etc.)
So returning an Observable keeps everything in the same reactive ecosystem.

map vs switchMap
Use map when:
No async calls inside
No new Observables
Just modifying the response
---
Use switchMap when:
Call an async function
Return another Observable
Flatten inner Observables
Replace the stream with a new one
 */
