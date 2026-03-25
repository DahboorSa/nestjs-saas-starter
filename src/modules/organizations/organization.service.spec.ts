import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationService } from './organization.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrganizationEntity } from './entities/organization.entity';
import { UtilityService } from '../../common/utils/utility.service';
import { UserService } from '../users/user.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { WebhookDispatcherService } from '../webhook-dispatchers/webhook-dispatcher.service';
import { NotFoundException } from '@nestjs/common';

const mockOrganizationRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  merge: jest.fn(),
};

const mockUtilityService = { generateSlug: jest.fn() };
const mockUserService = { getTotalActiveUsers: jest.fn() };
const mockAuditLogService = { create: jest.fn().mockResolvedValue(undefined) };
const mockDispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };

const auditContext = { ipAddress: '127.0.0.1', userAgent: 'jest' };
const userInfo = { userId: 'user-1', orgId: 'org-1' } as any;

const mockOrg: Partial<OrganizationEntity> = {
  id: 'org-1',
  name: 'Test Org',
  slug: 'test-org',
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
        { provide: UtilityService, useValue: mockUtilityService },
        { provide: UserService, useValue: mockUserService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: WebhookDispatcherService, useValue: mockDispatcher },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── getByName ────────────────────────────────────────────────────────────────

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

  // ─── getBySlug ────────────────────────────────────────────────────────────────

  describe('getBySlug', () => {
    it('should return organization by slug', async () => {
      mockOrganizationRepository.findOne.mockResolvedValue(mockOrg);

      const result = await service.getBySlug('test-org');

      expect(result).toEqual(mockOrg);
      expect(mockOrganizationRepository.findOne).toHaveBeenCalledWith({
        where: { slug: 'test-org' },
      });
    });

    it('should return null if not found', async () => {
      mockOrganizationRepository.findOne.mockResolvedValue(null);

      const result = await service.getBySlug('unknown-slug');

      expect(result).toBeNull();
    });
  });

  // ─── getById ──────────────────────────────────────────────────────────────────

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

  // ─── create ───────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create and return organization', async () => {
      mockOrganizationRepository.create.mockReturnValue(mockOrg);
      mockOrganizationRepository.save.mockResolvedValue(mockOrg);

      const result = await service.create({
        name: 'Test Org',
        slug: 'test-org',
      } as any);

      expect(result).toEqual(mockOrg);
      expect(mockOrganizationRepository.create).toHaveBeenCalled();
      expect(mockOrganizationRepository.save).toHaveBeenCalled();
    });
  });

  // ─── getDetails ───────────────────────────────────────────────────────────────

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

  // ─── getMemberLimitInfo ───────────────────────────────────────────────────────

  describe('getMemberLimitInfo', () => {
    it('should return plan and active member count', async () => {
      mockOrganizationRepository.findOne.mockResolvedValue(mockOrg);
      mockUserService.getTotalActiveUsers.mockResolvedValue(3);

      const result = await service.getMemberLimitInfo(userInfo);

      expect(result).toEqual({ plan: mockOrg.plan, count: 3 });
      expect(mockUserService.getTotalActiveUsers).toHaveBeenCalledWith('org-1');
    });
  });

  // ─── updateName ───────────────────────────────────────────────────────────────

  describe('updateName', () => {
    it('should throw NotFoundException if organization not found', async () => {
      mockUtilityService.generateSlug.mockReturnValue('new-name');
      mockOrganizationRepository.findOne
        .mockResolvedValueOnce(null) // getBySlug → no conflict
        .mockResolvedValueOnce(null); // getById → not found

      await expect(
        service.updateName(auditContext as any, userInfo, { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should generate a new slug if slug already exists', async () => {
      mockUtilityService.generateSlug
        .mockReturnValueOnce('new-name') // first call
        .mockReturnValueOnce('new-name-abc'); // second call with randomize
      mockOrganizationRepository.findOne
        .mockResolvedValueOnce(mockOrg) // getBySlug → conflict exists
        .mockResolvedValueOnce(mockOrg); // getById → found
      mockOrganizationRepository.merge.mockReturnValue(undefined);
      mockOrganizationRepository.save.mockResolvedValue({
        ...mockOrg,
        name: 'New Name',
        slug: 'new-name-abc',
      });

      const result = await service.updateName(auditContext as any, userInfo, {
        name: 'New Name',
      });

      expect(mockUtilityService.generateSlug).toHaveBeenCalledTimes(2);
      expect(result.slug).toBe('new-name-abc');
    });

    it('should update name and return updated organization', async () => {
      mockUtilityService.generateSlug.mockReturnValue('new-name');
      mockOrganizationRepository.findOne
        .mockResolvedValueOnce(null) // getBySlug → no conflict
        .mockResolvedValueOnce(mockOrg); // getById → found
      mockOrganizationRepository.merge.mockReturnValue(undefined);
      mockOrganizationRepository.save.mockResolvedValue({
        ...mockOrg,
        name: 'New Name',
        slug: 'new-name',
      });

      const result = await service.updateName(auditContext as any, userInfo, {
        name: 'New Name',
      });

      expect(result.name).toBe('New Name');
      expect(result.slug).toBe('new-name');
    });
  });
});
