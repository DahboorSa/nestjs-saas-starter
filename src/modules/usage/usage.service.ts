import { Injectable } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';
import { OrganizationEntity } from '../organizations/entities/organization.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { WebhookDispatcherService } from '../webhook-dispatchers/webhook-dispatcher.service';
import { WebhookEvent } from '../../enums';

@Injectable()
export class UsageService {
  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly organizationRepository: Repository<OrganizationEntity>,
    private readonly cacheService: CacheService,
    private readonly dispatcher: WebhookDispatcherService,
  ) {}

  async incrementUsage(
    orgId: string,
    metric: string,
    period: string,
  ): Promise<number> {
    // fix race condition
    return this.cacheService.incr(`usage:${orgId}:${metric}:${period}`);
  }

  async getUsage(
    orgId: string,
    metric: string,
    period: string,
  ): Promise<number> {
    const currentUsage = await this.cacheService.get(
      `usage:${orgId}:${metric}:${period}`,
    );
    return +currentUsage || 0;
  }

  async isLimitExceeded(orgId: string): Promise<boolean> {
    const limitExceeded = await this.cacheService.get(
      `usage:${orgId}:limit_exceeded`,
    );
    return Boolean(limitExceeded) || false;
  }

  async setLimitExceeded(
    orgId: string,
    ttl: number,
    { limit, current, period },
  ): Promise<void> {
    await this.cacheService.set(`usage:${orgId}:limit_exceeded`, true, ttl);
    this.dispatcher
      .dispatch(orgId, WebhookEvent.PLAN_LIMIT_EXCEEDED, {
        metric: 'api_calls',
        limit,
        current,
        period,
      })
      .catch(() => {});
  }

  async getPlanLimit(orgId: string): Promise<{
    apiCallsPerMonth: number;
    maxWebhooks: number;
    planId: number;
  }> {
    const usageDetails = await this.cacheService.get(`usage:${orgId}:limit`);
    if (usageDetails) {
      return JSON.parse(usageDetails);
    }
    const organization = await this.organizationRepository.findOne({
      where: { id: orgId },
      relations: ['plan'],
    });

    const plan = organization.plan;
    const { limits } = plan;
    const { apiCallsPerMonth, maxWebhooks } = limits;
    await this.cacheService.set(
      `usage:${orgId}:limit`,
      JSON.stringify({ apiCallsPerMonth, maxWebhooks, planId: plan.id }),
      +process.env.TTL_EXPIRATION,
    );
    return { apiCallsPerMonth, maxWebhooks, planId: plan.id };
  }
}
