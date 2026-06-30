import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationEntity } from '../organizations/entities/organization.entity';
import { UsageService } from '../usage/usage.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { AI_PROVIDER, IAiProvider } from './providers/ai-provider.interface';

const SYSTEM_PROMPT = `You are a helpful onboarding assistant for a SaaS platform.
You help new users understand how the platform works, get started quickly, and make the most of its features.

The platform includes ONLY these features:
- Organization management (invite members, assign roles: OWNER, ADMIN, MEMBER)
- API key management for programmatic access
- Subscription plans (Free, Pro, Enterprise) with usage limits
- Webhook endpoints for real-time event notifications
- Audit logs for tracking organization activity
- Usage tracking and analytics

The following features do NOT exist in this platform:
- Two-factor authentication (2FA) or any MFA
- SSO or OAuth login
- Organization deletion
- Ownership transfer
- Data export
- File uploads
- Custom domains (defined in plans but not yet implemented)
- Password-less login

STRICT RULE: If a user asks about a feature not listed above as available, you MUST say it is not currently available in the platform. Never invent steps, workarounds, or instructions for features that do not exist. Do not speculate about future availability.

Keep answers concise, practical, and beginner-friendly. When organization context is provided, tailor your answers to that org's current plan, usage, and recent activity.`;

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly orgRepo: Repository<OrganizationEntity>,
    private readonly usageService: UsageService,
    private readonly auditLogService: AuditLogService,
    @Inject(AI_PROVIDER) private readonly aiProvider: IAiProvider,
  ) {}

  private async gatherContext(orgId: string): Promise<string> {
    const [org, stats, recentLogs] = await Promise.all([
      this.orgRepo.findOne({
        where: { id: orgId },
        relations: ['plan', 'users', 'apiKeys', 'webhookEndpoints'],
      }),
      this.usageService.getStats(orgId),
      this.auditLogService.findByOrganization(orgId),
    ]);

    const plan = org.plan;
    const memberCount = org.users.filter((u) => u.isActive).length;
    const apiKeyCount = org.apiKeys.filter((k) => k.isActive).length;
    const webhookCount = org.webhookEndpoints.filter((w) => w.isActive).length;

    const trialLine = org.trialEndsAt
      ? `Trial ends: ${org.trialEndsAt.toISOString().split('T')[0]}`
      : null;

    const usageLimit =
      stats.apiCalls.limit === -1 ? 'unlimited' : stats.apiCalls.limit;

    const lines = [
      '=== Organization Context ===',
      `Name: ${org.name}`,
      `Plan: ${plan.name}`,
      `Payment status: ${org.paymentStatus}`,
      trialLine,
      '',
      '=== API Usage (this month) ===',
      `API Calls: ${stats.apiCalls.current} / ${usageLimit}`,
      `Limit exceeded: ${stats.apiCalls.limitExceeded ? 'Yes' : 'No'}`,
      '',
      '=== Members ===',
      `Active: ${memberCount} / ${plan.limits.maxMembers}`,
      '',
      '=== API Keys ===',
      `Active: ${apiKeyCount} / ${plan.limits.maxApiKeys}`,
      '',
      '=== Webhooks ===',
      `Active: ${webhookCount} / ${plan.limits.maxWebhooks}`,
      '',
      '=== Plan Features ===',
      `Webhooks: ${plan.features.webhooks ? 'enabled' : 'not available on this plan'}`,
      `Analytics: ${plan.features.analytics ? 'enabled' : 'not available on this plan'}`,
      `Custom domain: ${plan.features.customDomain ? 'enabled' : 'not available on this plan'}`,
    ];

    if (recentLogs.length > 0) {
      lines.push('', '=== Recent Activity (last 24h) ===');
      recentLogs.slice(0, 5).forEach((log) => {
        const date = log.createdAt.toISOString().split('T')[0];
        lines.push(`- [${date}] ${log.action} on ${log.resourceType}`);
      });
    }

    return lines.filter((l) => l !== null).join('\n');
  }

  async ask(question: string, orgId: string): Promise<{ answer: string }> {
    try {
      const context = await this.gatherContext(orgId);
      const systemPrompt = `${SYSTEM_PROMPT}\n\n${context}`;
      const answer = await this.aiProvider.ask(systemPrompt, question);
      return { answer };
    } catch (err) {
      this.logger.error('AI provider failed', err);
      throw new InternalServerErrorException(
        err instanceof Error
          ? err.message
          : 'Failed to get a response from the AI assistant',
      );
    }
  }
}
