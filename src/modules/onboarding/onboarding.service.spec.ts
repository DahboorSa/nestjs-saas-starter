import { Test, TestingModule } from '@nestjs/testing';
import { OnboardingService } from './onboarding.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrganizationEntity } from '../organizations/entities/organization.entity';
import { UsageService } from '../usage/usage.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { AI_PROVIDER } from './providers/ai-provider.interface';
import { InternalServerErrorException } from '@nestjs/common';

const mockOrg = {
  id: 'org-1',
  name: 'Acme Corp',
  paymentStatus: 'active',
  trialEndsAt: null,
  plan: {
    name: 'Pro',
    limits: { maxMembers: 25, maxApiKeys: 10, maxWebhooks: 100 },
    features: { webhooks: true, analytics: true, customDomain: false },
  },
  users: [{ isActive: true }, { isActive: true }, { isActive: false }],
  apiKeys: [{ isActive: true }],
  webhookEndpoints: [{ isActive: true }, { isActive: true }],
};

const mockStats = {
  apiCalls: { current: 42, limit: 50000, limitExceeded: false },
};

const mockLogs = [
  {
    action: 'MEMBER_INVITED',
    resourceType: 'user',
    createdAt: new Date('2026-06-01T10:00:00Z'),
  },
];

const mockOrgRepo = { findOne: jest.fn() };
const mockUsageService = { getStats: jest.fn() };
const mockAuditLogService = { findByOrganization: jest.fn() };
const mockAiProvider = { ask: jest.fn() };

describe('OnboardingService', () => {
  let service: OnboardingService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockOrgRepo.findOne.mockResolvedValue(mockOrg);
    mockUsageService.getStats.mockResolvedValue(mockStats);
    mockAuditLogService.findByOrganization.mockResolvedValue(mockLogs);
    mockAiProvider.ask.mockResolvedValue('Here is how to get started...');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        {
          provide: getRepositoryToken(OrganizationEntity),
          useValue: mockOrgRepo,
        },
        { provide: UsageService, useValue: mockUsageService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: AI_PROVIDER, useValue: mockAiProvider },
      ],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── ask ──────────────────────────────────────────────────────────────────────

  describe('ask', () => {
    it('should return an answer from the AI provider', async () => {
      const result = await service.ask('How do I invite a member?', 'org-1');

      expect(result).toEqual({ answer: 'Here is how to get started...' });
    });

    it('should call AI provider with org context injected into system prompt', async () => {
      await service.ask('How do I invite a member?', 'org-1');

      expect(mockAiProvider.ask).toHaveBeenCalledTimes(1);
      const [systemPrompt, question] = mockAiProvider.ask.mock.calls[0];
      expect(systemPrompt).toContain('Acme Corp');
      expect(systemPrompt).toContain('Pro');
      expect(question).toBe('How do I invite a member?');
    });

    it('should include usage stats in the context', async () => {
      await service.ask('What is my usage?', 'org-1');

      const [systemPrompt] = mockAiProvider.ask.mock.calls[0];
      expect(systemPrompt).toContain('42');
      expect(systemPrompt).toContain('50000');
    });

    it('should include recent audit log activity when logs exist', async () => {
      await service.ask('What happened recently?', 'org-1');

      const [systemPrompt] = mockAiProvider.ask.mock.calls[0];
      expect(systemPrompt).toContain('MEMBER_INVITED');
    });

    it('should omit recent activity section when no logs exist', async () => {
      mockAuditLogService.findByOrganization.mockResolvedValue([]);

      await service.ask('What happened recently?', 'org-1');

      const [systemPrompt] = mockAiProvider.ask.mock.calls[0];
      expect(systemPrompt).not.toContain('Recent Activity');
    });

    it('should include trial end date when trialEndsAt is set', async () => {
      mockOrgRepo.findOne.mockResolvedValue({
        ...mockOrg,
        trialEndsAt: new Date('2026-07-15T00:00:00Z'),
      });

      await service.ask('When does my trial end?', 'org-1');

      const [systemPrompt] = mockAiProvider.ask.mock.calls[0];
      expect(systemPrompt).toContain('2026-07-15');
    });

    it('should show "unlimited" when api call limit is -1', async () => {
      mockUsageService.getStats.mockResolvedValue({
        apiCalls: { current: 100, limit: -1, limitExceeded: false },
      });

      await service.ask('What are my limits?', 'org-1');

      const [systemPrompt] = mockAiProvider.ask.mock.calls[0];
      expect(systemPrompt).toContain('unlimited');
    });

    it('should throw InternalServerErrorException when AI provider fails', async () => {
      mockAiProvider.ask.mockRejectedValue(new Error('API timeout'));

      await expect(
        service.ask('How do I invite a member?', 'org-1'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException when org repo fails', async () => {
      mockOrgRepo.findOne.mockRejectedValue(new Error('DB error'));

      await expect(
        service.ask('How do I invite a member?', 'org-1'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
