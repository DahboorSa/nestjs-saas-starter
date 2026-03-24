import {
  CallHandler,
  ForbiddenException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { from, Observable, switchMap } from 'rxjs';
import { WebhookService } from '../webhook.service';
import { UsageService } from '../../usage/usage.service';

@Injectable()
export class WebhookTrackerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(WebhookTrackerInterceptor.name);
  constructor(
    private readonly usageService: UsageService,
    private readonly webhookService: WebhookService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();

    return from(
      Promise.all([
        this.webhookService.getActiveWebhookEvents(req.user.orgId),
        this.usageService.getPlanLimit(req.user.orgId),
      ]),
    ).pipe(
      switchMap(([count, plan]) => {
        this.logger.log(`Active webhooks: ${count}`);
        const limit = plan.maxWebhooks ?? -1;
        if (limit !== -1 && count >= limit) {
          throw new ForbiddenException('Upgrade your plan to use webhooks');
        }
        return next.handle();
      }),
    );
  }
}
