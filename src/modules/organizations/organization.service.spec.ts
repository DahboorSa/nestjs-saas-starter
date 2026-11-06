import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationService } from './organization.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrganizationEntity } from './entities/organization.entity';
import { UserService } from '../users/user.service';
import { PlanService } from '../plans/plan.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { WebhookDispatcherService } from '../webhook-dispatchers/webhook-dispatcher.service';
import { StripeService } from '../stripe/stripe.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaymentStatus } from '../../enums';

const mockOrganizationRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  merge: jest.fn(),
};

const mockUserService = { getTotalActiveUsers: jest.fn() };
const mockPlanService = { getByName: jest.fn() };
const mockAuditLogService = { create: jest.fn().mockResolvedValue(undefined) };
const mockDispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
const mockStripeService = { updateSubscription: jest.fn() };

const auditContext = { ipAddress: '127.0.0.1', userAgent: 'jest' };
const userInfo = { userId: 'user-1', orgId: 'org-1' } as any;

const mockOrg: Partial<OrganizationEntity> = {
  id: 'org-1',
  name: 'Test Org',
  isActive: true,
  plan: { id: 1, name: 'Free', limits: { maxMembers: 5 } } as any,
};

describe('OrganizationService', () => {
  let service: OrganizationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAuditLogService.create.mockResolvedValue(undefined);
    mockDispatcher.dispatch.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        {
          provide: getRepositoryToken(OrganizationEntity),
          useValue: mockOrganizationRepository,
        },
        { provide: UserService, useValue: mockUserService },
        { provide: PlanService, useValue: mockPlanService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: WebhookDispatcherService, useValue: mockDispatcher },
        { provide: StripeService, useValue: mockStripeService },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getByName', () => {
    it('should return organization by name', async () => {
      mockOrganizationRepository.findOne.mockResolvedValue(mockOrg);

      const result = await service.getByName('Test Org');

      expect(result).toEqual(mockOrg);
      expect(mockOrganizationRepository.findOne).toHaveBeenCalledWith({
        where: { name: 'Test Org' },
      });
    });

    it('should return null if not found', async () => {
      mockOrganizationRepository.findOne.mockResolvedValue(null);

      const result = await service.getByName('Unknown');

      expect(result).toBeNull();
    });
  });

  describe('getById', () => {
    it('should return organization with plan relation', async () => {
      mockOrganizationRepository.findOne.mockResolvedValue(mockOrg);

      const result = await service.getById('org-1');

      expect(result).toEqual(mockOrg);
      expect(mockOrganizationRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        relations: ['plan'],
      });
    });

    it('should return null if not found', async () => {
      mockOrganizationRepository.findOne.mockResolvedValue(null);

      const result = await service.getById('unknown-id');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create and return organization', async () => {
      mockOrganizationRepository.create.mockReturnValue(mockOrg);
      mockOrganizationRepository.save.mockResolvedValue(mockOrg);

      const result = await service.create({ name: 'Test Org' } as any);

      expect(result).toEqual(mockOrg);
      expect(mockOrganizationRepository.create).toHaveBeenCalled();
      expect(mockOrganizationRepository.save).toHaveBeenCalled();
    });
  });

  describe('getDetails', () => {
    it('should return active organization with plan relation', async () => {
      mockOrganizationRepository.findOne.mockResolvedValue(mockOrg);

      const result = await service.getDetails(userInfo);

      expect(result).toEqual(mockOrg);
      expect(mockOrganizationRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'org-1', isActive: true },
        relations: ['plan'],
      });
    });

    it('should return null if organization not found', async () => {
      mockOrganizationRepository.findOne.mockResolvedValue(null);

      const result = await service.getDetails(userInfo);

      expect(result).toBeNull();
    });
  });

  describe('getMemberLimitInfo', () => {
    it('should return plan and active member count', async () => {
      mockOrganizationRepository.findOne.mockResolvedValue(mockOrg);
      mockUserService.getTotalActiveUsers.mockResolvedValue(3);

      const result = await service.getMemberLimitInfo(userInfo);

      expect(result).toEqual({ plan: mockOrg.plan, count: 3 });
      expect(mockUserService.getTotalActiveUsers).toHaveBeenCalledWith('org-1');
    });
  });

  describe('updateName', () => {
    it('should throw NotFoundException if organization not found', async () => {
      mockOrganizationRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.updateName(auditContext as any, userInfo, { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockOrganizationRepository.save).not.toHaveBeenCalled();
    });

    it('should update only the name and return the saved organization', async () => {
      mockOrganizationRepository.findOne.mockResolvedValueOnce({ ...mockOrg });
      mockOrganizationRepository.merge.mockReturnValue(undefined);
      mockOrganizationRepository.save.mockResolvedValue({
        ...mockOrg,
        name: 'New Name',
      });

      const result = await service.updateName(auditContext as any, userInfo, {
        name: 'New Name',
      });

      expect(mockOrganizationRepository.merge).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'org-1' }),
        { name: 'New Name' },
      );
      expect(result.name).toBe('New Name');
    });

    it('should audit and dispatch the old and new name', async () => {
      mockOrganizationRepository.findOne.mockResolvedValueOnce({ ...mockOrg });
      mockOrganizationRepository.save.mockResolvedValue({
        ...mockOrg,
        name: 'New Name',
      });

      await service.updateName(auditContext as any, userInfo, {
        name: 'New Name',
      });

      expect(mockAuditLogService.create).toHaveBeenCalled();
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'org-1',
        expect.anything(),
        { oldName: 'Test Org', newName: 'New Name' },
      );
    });
  });

  describe('updatePlan', () => {
    it('should throw NotFoundException if organization not found', async () => {
      mockOrganizationRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.updatePlan(auditContext as any, userInfo, {
          plan: 'Pro',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if org has no active subscription', async () => {
      mockOrganizationRepository.findOne.mockResolvedValueOnce({
        ...mockOrg,
        stripeSubscriptionId: null,
        paymentStatus: PaymentStatus.FREE,
      });

      await expect(
        service.updatePlan(auditContext as any, userInfo, {
          plan: 'Pro',
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if new plan does not exist', async () => {
      mockOrganizationRepository.findOne.mockResolvedValueOnce({
        ...mockOrg,
        stripeSubscriptionId: 'sub_123',
        paymentStatus: PaymentStatus.ACTIVE,
      });
      mockPlanService.getByName.mockResolvedValue(null);

      await expect(
        service.updatePlan(auditContext as any, userInfo, {
          plan: 'Unknown',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update the organization plan when payment is active', async () => {
      const activeOrg = {
        ...mockOrg,
        stripeSubscriptionId: 'sub_123',
        paymentStatus: PaymentStatus.ACTIVE,
      };
      const proPlan = { id: 2, name: 'Pro', stripePriceId: 'price_pro' };
      mockOrganizationRepository.findOne.mockResolvedValueOnce(activeOrg);
      mockPlanService.getByName.mockResolvedValue(proPlan);
      mockStripeService.updateSubscription.mockResolvedValue({});
      mockOrganizationRepository.save.mockResolvedValue({
        ...activeOrg,
        plan: proPlan,
      });

      const result = await service.updatePlan(auditContext as any, userInfo, {
        plan: 'Pro',
      } as any);

      expect(mockStripeService.updateSubscription).toHaveBeenCalledWith(
        'sub_123',
        'price_pro',
      );
      expect(mockOrganizationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ plan: proPlan }),
      );
      expect(result.plan).toEqual(proPlan);
    });

    it('should move a trialing org to ACTIVE and clear trialEndsAt on plan switch', async () => {
      const trialOrg = {
        ...mockOrg,
        stripeSubscriptionId: 'sub_123',
        paymentStatus: PaymentStatus.TRIAL,
        trialEndsAt: new Date(),
      };
      const proPlan = { id: 2, name: 'Pro', stripePriceId: 'price_pro' };
      mockOrganizationRepository.findOne.mockResolvedValueOnce(trialOrg);
      mockPlanService.getByName.mockResolvedValue(proPlan);
      mockStripeService.updateSubscription.mockResolvedValue({});
      mockOrganizationRepository.save.mockImplementation(async (org) => org);

      const result = await service.updatePlan(auditContext as any, userInfo, {
        plan: 'Pro',
      } as any);

      expect(mockStripeService.updateSubscription).toHaveBeenCalledWith(
        'sub_123',
        'price_pro',
      );
      expect(result.paymentStatus).toBe(PaymentStatus.ACTIVE);
      expect(result.trialEndsAt).toBeNull();
    });
  });
});
