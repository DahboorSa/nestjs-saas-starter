import { Test, TestingModule } from '@nestjs/testing';
import { InvitationService } from './invitation.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InvitationEntity } from './entities/invitation.entity';
import { UserService } from '../users/user.service';
import { OrganizationService } from '../organizations/organization.service';
import { CacheService } from '../../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { EmailQueueService } from '../../jobs/queues/email.queue';
import { JwtUtilityService } from '../../common/utils/jwt-utility.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { WebhookDispatcherService } from '../webhook-dispatchers/webhook-dispatcher.service';
import {
  ConflictException,
  RequestTimeoutException,
  UnauthorizedException,
} from '@nestjs/common';
import { InvitationStatus, UserRole } from '../../enums';
import * as argon from 'argon2';

jest.mock('argon2');

const mockInvitationRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  preload: jest.fn(),
  update: jest.fn(),
};

const mockUserService = {
  getByEmail: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  preload: jest.fn(),
};

const mockOrganizationService = { getDetails: jest.fn() };
const mockCacheService = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'INVITE_TOKEN_TTL') return 172800;
    if (key === 'jwt.jwtRefreshRedisExpiry') return 604800;
    return null;
  }),
};
const mockEmailQueue = { add: jest.fn().mockResolvedValue(undefined) };
const mockJwtUtilityService = {
  generateToken: jest.fn().mockReturnValue({
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  }),
};
const mockAuditLogService = { create: jest.fn().mockResolvedValue(undefined) };
const mockDispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };

const auditContext = { ipAddress: '127.0.0.1', userAgent: 'jest' };
const userInfo = {
  userId: 'user-1',
  orgId: 'org-1',
  email: 'owner@example.com',
  role: UserRole.OWNER,
} as any;

const mockOrg = { id: 'org-1', name: 'Test Org' } as any;
const mockInviter = {
  id: 'user-1',
  firstName: 'John',
  organization: mockOrg,
} as any;

const mockInvitation: Partial<InvitationEntity> = {
  id: 1,
  email: 'invite@example.com',
  role: UserRole.MEMBER,
  token: 'valid-token',
  status: InvitationStatus.PENDING,
  expiresAt: new Date(Date.now() + 172800000),
  organization: mockOrg,
};

describe('InvitationService', () => {
  let service: InvitationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAuditLogService.create.mockResolvedValue(undefined);
    mockDispatcher.dispatch.mockResolvedValue(undefined);
    mockJwtUtilityService.generateToken.mockReturnValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationService,
        {
          provide: getRepositoryToken(InvitationEntity),
          useValue: mockInvitationRepository,
        },
        { provide: UserService, useValue: mockUserService },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EmailQueueService, useValue: mockEmailQueue },
        { provide: JwtUtilityService, useValue: mockJwtUtilityService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: WebhookDispatcherService, useValue: mockDispatcher },
      ],
    }).compile();

    service = module.get<InvitationService>(InvitationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPendingInvitationByEmail', () => {
    it('should return pending invitation by email', async () => {
      mockInvitationRepository.findOne.mockResolvedValue(mockInvitation);

      const result =
        await service.getPendingInvitationByEmail('invite@example.com');

      expect(result).toEqual(mockInvitation);
      expect(mockInvitationRepository.findOne).toHaveBeenCalledWith({
        where: {
          email: 'invite@example.com',
          status: InvitationStatus.PENDING,
        },
      });
    });

    it('should return null if no pending invitation found', async () => {
      mockInvitationRepository.findOne.mockResolvedValue(null);

      const result = await service.getPendingInvitationByEmail(
        'unknown@example.com',
      );

      expect(result).toBeNull();
    });
  });

  describe('getList', () => {
    it('should return invitations filtered by status', async () => {
      mockInvitationRepository.find.mockResolvedValue([mockInvitation]);

      const result = await service.getList(userInfo, InvitationStatus.PENDING);

      expect(result).toHaveLength(1);
      expect(mockInvitationRepository.find).toHaveBeenCalledWith({
        where: {
          status: InvitationStatus.PENDING,
          organization: { id: 'org-1' },
        },
      });
    });

    it('should return empty array if no invitations found', async () => {
      mockInvitationRepository.find.mockResolvedValue([]);

      const result = await service.getList(userInfo, InvitationStatus.ACCEPTED);

      expect(result).toEqual([]);
    });
  });

  describe('send', () => {
    const sendDto = { email: 'invite@example.com', role: UserRole.MEMBER };

    it('should throw ConflictException if user already exists in same org', async () => {
      mockUserService.getByEmail.mockResolvedValue({
        isActive: true,
        organization: { id: 'org-1' },
      });

      await expect(
        service.send(auditContext as any, userInfo, sendDto as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if user already exists in different org', async () => {
      mockUserService.getByEmail.mockResolvedValue({
        isActive: true,
        organization: { id: 'other-org' },
      });

      await expect(
        service.send(auditContext as any, userInfo, sendDto as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if pending invitation already exists', async () => {
      mockUserService.getByEmail.mockResolvedValue(null);
      mockInvitationRepository.findOne.mockResolvedValue(mockInvitation);

      await expect(
        service.send(auditContext as any, userInfo, sendDto as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should send invitation and return success message', async () => {
      mockUserService.getByEmail.mockResolvedValue(null);
      mockInvitationRepository.findOne.mockResolvedValue(null);
      mockUserService.getById.mockResolvedValue(mockInviter);
      mockInvitationRepository.create.mockReturnValue(mockInvitation);
      mockInvitationRepository.save.mockResolvedValue(mockInvitation);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.send(
        auditContext as any,
        userInfo,
        sendDto as any,
      );

      expect(result).toEqual({ message: 'Invitation sent successfully' });
      expect(mockEmailQueue.add).toHaveBeenCalledWith(
        'invite.email',
        expect.any(Object),
      );
    });
  });

  describe('acceptInvitation', () => {
    const acceptDto = {
      password: 'Password123!',
      firstName: 'Jane',
      lastName: 'Doe',
    };
    const validTokenData = JSON.stringify({
      invitationId: 1,
      email: 'invite@example.com',
      orgId: 'org-1',
      role: UserRole.MEMBER,
      status: InvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 172800000).toISOString(),
    });

    it('should throw UnauthorizedException if token not in cache and not in DB', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockInvitationRepository.findOne.mockResolvedValue(null);

      await expect(
        service.acceptInvitation(
          auditContext as any,
          'bad-token',
          acceptDto as any,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ConflictException if invitation is already accepted', async () => {
      const acceptedData = JSON.stringify({
        invitationId: 1,
        email: 'invite@example.com',
        orgId: 'org-1',
        role: UserRole.MEMBER,
        status: InvitationStatus.ACCEPTED,
        expiresAt: new Date(Date.now() + 172800000).toISOString(),
      });
      mockCacheService.get.mockResolvedValue(acceptedData);

      await expect(
        service.acceptInvitation(
          auditContext as any,
          'token',
          acceptDto as any,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw RequestTimeoutException if invitation is expired', async () => {
      const expiredData = JSON.stringify({
        invitationId: 1,
        email: 'invite@example.com',
        orgId: 'org-1',
        role: UserRole.MEMBER,
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() - 1000).toISOString(), // past
      });
      mockCacheService.get.mockResolvedValue(expiredData);

      await expect(
        service.acceptInvitation(
          auditContext as any,
          'token',
          acceptDto as any,
        ),
      ).rejects.toThrow(RequestTimeoutException);
    });

    it('should throw ConflictException if user already active in same org', async () => {
      mockCacheService.get.mockResolvedValue(validTokenData);
      mockUserService.getByEmail.mockResolvedValue({
        isActive: true,
        organization: { id: 'org-1' },
      });

      await expect(
        service.acceptInvitation(
          auditContext as any,
          'token',
          acceptDto as any,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should create new user and return tokens on success', async () => {
      mockCacheService.get.mockResolvedValue(validTokenData);
      mockUserService.getByEmail.mockResolvedValue(null);
      (argon.hash as jest.Mock).mockResolvedValue('hashed-password');

      const newUser = {
        id: 'new-user',
        organization: { id: 'org-1' },
        role: UserRole.MEMBER,
        email: 'invite@example.com',
      };
      mockUserService.create.mockResolvedValue(newUser);
      mockInvitationRepository.preload.mockResolvedValue({
        id: 1,
        status: InvitationStatus.PENDING,
      });
      mockInvitationRepository.save.mockResolvedValue(undefined);
      mockCacheService.set.mockResolvedValue(undefined);
      mockCacheService.delete.mockResolvedValue(undefined);

      const result = await service.acceptInvitation(
        auditContext as any,
        'token',
        acceptDto as any,
      );

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(mockUserService.create).toHaveBeenCalled();
    });

    it('should reactivate existing inactive user on accept', async () => {
      mockCacheService.get.mockResolvedValue(validTokenData);
      const inactiveUser = {
        id: 'existing-user',
        isActive: false,
        organization: { id: 'other-org' },
      };
      mockUserService.getByEmail.mockResolvedValue(inactiveUser);
      (argon.hash as jest.Mock).mockResolvedValue('hashed-password');

      const reactivatedUser = {
        id: 'existing-user',
        organization: { id: 'org-1' },
        role: UserRole.MEMBER,
        email: 'invite@example.com',
      };
      mockUserService.preload.mockResolvedValue(reactivatedUser);
      mockInvitationRepository.preload.mockResolvedValue({
        id: 1,
        status: InvitationStatus.PENDING,
      });
      mockInvitationRepository.save.mockResolvedValue(undefined);
      mockCacheService.set.mockResolvedValue(undefined);
      mockCacheService.delete.mockResolvedValue(undefined);

      const result = await service.acceptInvitation(
        auditContext as any,
        'token',
        acceptDto as any,
      );

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(mockUserService.preload).toHaveBeenCalled();
    });

    it('should fall back to DB if token not in cache', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockInvitationRepository.findOne.mockResolvedValue({
        ...mockInvitation,
        organization: mockOrg,
      });
      mockUserService.getByEmail.mockResolvedValue(null);
      (argon.hash as jest.Mock).mockResolvedValue('hashed-password');

      const newUser = {
        id: 'new-user',
        organization: { id: 'org-1' },
        role: UserRole.MEMBER,
        email: 'invite@example.com',
      };
      mockUserService.create.mockResolvedValue(newUser);
      mockInvitationRepository.preload.mockResolvedValue({
        id: 1,
        status: InvitationStatus.PENDING,
      });
      mockInvitationRepository.save.mockResolvedValue(undefined);
      mockCacheService.set.mockResolvedValue(undefined);
      mockCacheService.delete.mockResolvedValue(undefined);

      const result = await service.acceptInvitation(
        auditContext as any,
        'valid-token',
        acceptDto as any,
      );

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });
  });

  describe('expireInvitations', () => {
    it('should update all pending expired invitations to EXPIRED status', async () => {
      mockInvitationRepository.update.mockResolvedValue({ affected: 3 });

      await service.expireInvitations();

      expect(mockInvitationRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: InvitationStatus.PENDING }),
        { status: InvitationStatus.EXPIRED },
      );
    });
  });
});
