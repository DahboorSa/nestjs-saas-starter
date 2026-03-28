import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { CacheService } from '../../cache/cache.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { WebhookDispatcherService } from '../webhook-dispatchers/webhook-dispatcher.service';
import { EmailQueueService } from '../../jobs/queues/email.queue';
import { JwtUtilityService } from '../../common/utils/jwt-utility.service';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '../../enums';

const mockUserRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  merge: jest.fn(),
  preload: jest.fn(),
  count: jest.fn(),
};

const mockCacheService = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
const mockAuditLogService = { create: jest.fn().mockResolvedValue(undefined) };
const mockDispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
const mockEmailQueue = { add: jest.fn().mockResolvedValue(undefined) };
const mockJwtUtilityService = {
  issueTokenPair: jest.fn().mockResolvedValue({
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  }),
};
const mockConfigService = { get: jest.fn().mockReturnValue(86400) };

const auditContext = { ipAddress: '127.0.0.1', userAgent: 'jest' };

const mockUser: Partial<UserEntity> = {
  id: 'user-1',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  userName: 'test',
  role: UserRole.MEMBER,
  isVerified: true,
  isActive: true,
  organization: { id: 'org-1' } as any,
};

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAuditLogService.create.mockResolvedValue(undefined);
    mockDispatcher.dispatch.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockUserRepository,
        },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: JwtUtilityService, useValue: mockJwtUtilityService },
        { provide: EmailQueueService, useValue: mockEmailQueue },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: WebhookDispatcherService, useValue: mockDispatcher },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── findAll ──────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return mapped active users for the organization', async () => {
      mockUserRepository.find.mockResolvedValue([mockUser]);

      const result = await service.findAll('org-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'user-1',
        email: 'test@example.com',
      });
    });

    it('should return empty array if no users found', async () => {
      mockUserRepository.find.mockResolvedValue([]);

      const result = await service.findAll('org-1');

      expect(result).toEqual([]);
    });
  });

  // ─── getByEmail ───────────────────────────────────────────────────────────────

  describe('getByEmail', () => {
    it('should return user without org relation', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(mockUser);

      const result = await service.getByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findOneBy).toHaveBeenCalledWith({
        email: 'test@example.com',
      });
    });

    it('should return user with org relation when includeOrg is true', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getByEmail('test@example.com', true);

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        relations: ['organization'],
      });
    });
  });

  // ─── getById ──────────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('should return user without org relation', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(mockUser);

      const result = await service.getById('user-1', 'org-1');

      expect(result).toEqual(mockUser);
    });

    it('should return user with org relation when includeOrg is true', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getById('user-1', 'org-1', true);

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1', organization: { id: 'org-1' } },
        relations: ['organization'],
      });
    });
  });

  // ─── getDetails ───────────────────────────────────────────────────────────────

  describe('getDetails', () => {
    it('should return mapped user details', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getDetails({
        userId: 'user-1',
        orgId: 'org-1',
      } as any);

      expect(result).toMatchObject({ id: 'user-1', email: 'test@example.com' });
    });

    it('should return null if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.getDetails({
        userId: 'user-1',
        orgId: 'org-1',
      } as any);

      expect(result).toBeNull();
    });
  });

  // ─── preload ──────────────────────────────────────────────────────────────────

  describe('preload', () => {
    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.preload.mockResolvedValue(null);

      await expect(
        service.preload('user-1', { isVerified: true }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should save and return updated user', async () => {
      const updated = { ...mockUser, isVerified: true };
      mockUserRepository.preload.mockResolvedValue(updated);
      mockUserRepository.save.mockResolvedValue(updated);

      const result = await service.preload('user-1', { isVerified: true });

      expect(result).toEqual(updated);
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────────

  describe('remove', () => {
    const currentUser = {
      userId: 'admin-1',
      orgId: 'org-1',
      role: UserRole.ADMIN,
    } as any;

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.remove(auditContext as any, currentUser, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is already removed', async () => {
      mockUserRepository.findOneBy.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(
        service.remove(auditContext as any, currentUser, 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if removing yourself', async () => {
      mockUserRepository.findOneBy.mockResolvedValue({
        ...mockUser,
        id: 'admin-1',
      });

      await expect(
        service.remove(
          auditContext as any,
          { ...currentUser, userId: 'admin-1' },
          'admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if removing the owner', async () => {
      mockUserRepository.findOneBy.mockResolvedValue({
        ...mockUser,
        role: UserRole.OWNER,
      });

      await expect(
        service.remove(auditContext as any, currentUser, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if admin tries to remove another admin', async () => {
      mockUserRepository.findOneBy.mockResolvedValue({
        ...mockUser,
        role: UserRole.ADMIN,
      });

      await expect(
        service.remove(auditContext as any, currentUser, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should remove user and return mapped data', async () => {
      const targetUser = { ...mockUser, id: 'user-1', role: UserRole.MEMBER };
      mockUserRepository.findOneBy.mockResolvedValue(targetUser);
      mockUserRepository.merge.mockReturnValue(undefined);
      mockUserRepository.save.mockResolvedValue({
        ...targetUser,
        isActive: false,
      });
      mockCacheService.delete.mockResolvedValue(undefined);

      const result = await service.remove(
        auditContext as any,
        currentUser,
        'user-1',
      );

      expect(result).toMatchObject({ id: 'user-1' });
      expect(mockCacheService.delete).toHaveBeenCalledWith(
        'auth:refresh:user-1',
      );
    });
  });

  // ─── updateRole ───────────────────────────────────────────────────────────────

  describe('updateRole', () => {
    const currentUser = {
      userId: 'owner-1',
      orgId: 'org-1',
      role: UserRole.OWNER,
    } as any;

    it('should throw BadRequestException if assigning owner role', async () => {
      await expect(
        service.updateRole(auditContext as any, currentUser, {
          id: 'user-1',
          role: UserRole.OWNER,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.updateRole(auditContext as any, currentUser, {
          id: 'user-1',
          role: UserRole.ADMIN,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is deactivated', async () => {
      mockUserRepository.findOneBy.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(
        service.updateRole(auditContext as any, currentUser, {
          id: 'user-1',
          role: UserRole.ADMIN,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if updating own role', async () => {
      mockUserRepository.findOneBy.mockResolvedValue({
        ...mockUser,
        id: 'owner-1',
      });

      await expect(
        service.updateRole(
          auditContext as any,
          { ...currentUser, userId: 'owner-1' },
          { id: 'owner-1', role: UserRole.ADMIN },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if role is already assigned', async () => {
      mockUserRepository.findOneBy.mockResolvedValue({
        ...mockUser,
        role: UserRole.ADMIN,
      });

      await expect(
        service.updateRole(auditContext as any, currentUser, {
          id: 'user-1',
          role: UserRole.ADMIN,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if updating another owner', async () => {
      mockUserRepository.findOneBy.mockResolvedValue({
        ...mockUser,
        role: UserRole.OWNER,
      });

      await expect(
        service.updateRole(auditContext as any, currentUser, {
          id: 'user-1',
          role: UserRole.ADMIN,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update role and return mapped user', async () => {
      const targetUser = { ...mockUser, id: 'user-1', role: UserRole.MEMBER };
      mockUserRepository.findOneBy.mockResolvedValue(targetUser);
      mockUserRepository.merge.mockReturnValue(undefined);
      mockUserRepository.save.mockResolvedValue({
        ...targetUser,
        role: UserRole.ADMIN,
      });

      const result = await service.updateRole(
        auditContext as any,
        currentUser,
        { id: 'user-1', role: UserRole.ADMIN },
      );

      expect(result).toMatchObject({ id: 'user-1' });
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────────

  describe('update', () => {
    const currentUser = { userId: 'user-1', orgId: 'org-1' } as any;

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.update(auditContext as any, currentUser, { firstName: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update and return mapped user', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(mockUser);
      mockUserRepository.merge.mockReturnValue(undefined);
      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        firstName: 'New',
      });

      const result = await service.update(auditContext as any, currentUser, {
        firstName: 'New',
      });

      expect(result).toMatchObject({ id: 'user-1' });
    });
  });

  // ─── changeEmail ──────────────────────────────────────────────────────────────

  describe('changeEmail', () => {
    const currentUser = {
      userId: 'user-1',
      orgId: 'org-1',
      email: 'old@example.com',
    } as any;

    it('should throw BadRequestException if new email is same as current', async () => {
      await expect(
        service.changeEmail(currentUser, { email: 'old@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if email is taken by another user', async () => {
      mockUserRepository.findOneBy.mockResolvedValue({
        id: 'other-user',
        email: 'new@example.com',
      });

      await expect(
        service.changeEmail(currentUser, { email: 'new@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should send email change request and return message', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(null);
      mockCacheService.set.mockResolvedValue(undefined);
      mockEmailQueue.add.mockResolvedValue(undefined);

      const result = await service.changeEmail(currentUser, {
        email: 'new@example.com',
      });

      expect(result.message).toBeDefined();
      expect(mockEmailQueue.add).toHaveBeenCalledWith(
        'change-email.email',
        expect.any(Object),
      );
    });
  });

  // ─── confirmEmailChange ───────────────────────────────────────────────────────

  describe('confirmEmailChange', () => {
    const tokenData = JSON.stringify({
      userId: 'user-1',
      orgId: 'org-1',
      email: 'new@example.com',
      oldEmail: 'old@example.com',
    });

    it('should throw UnauthorizedException if token is invalid', async () => {
      mockCacheService.get.mockResolvedValue(null);

      await expect(
        service.confirmEmailChange(auditContext as any, 'bad-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockCacheService.get.mockResolvedValue(tokenData);
      mockUserRepository.findOneBy.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.confirmEmailChange(auditContext as any, 'token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is deactivated', async () => {
      mockCacheService.get.mockResolvedValue(tokenData);
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(
        service.confirmEmailChange(auditContext as any, 'token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should confirm email change and return new tokens', async () => {
      mockCacheService.get.mockResolvedValue(tokenData);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.merge.mockReturnValue(undefined);
      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        email: 'new@example.com',
      });
      mockCacheService.delete.mockResolvedValue(undefined);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.confirmEmailChange(
        auditContext as any,
        'token',
      );

      expect(result).toMatchObject({
        message: 'Email change request has been confirmed',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(mockCacheService.delete).toHaveBeenCalledWith(
        'change:email:token',
      );
    });
  });

  // ─── updateLastLogin ──────────────────────────────────────────────────────────

  describe('updateLastLogin', () => {
    it('should save lastLoginAt for the user', async () => {
      mockUserRepository.save.mockResolvedValue(undefined);

      await service.updateLastLogin('user-1');

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'user-1',
          lastLoginAt: expect.any(Date),
        }),
      );
    });
  });

  // ─── updatePassword ───────────────────────────────────────────────────────────

  describe('updatePassword', () => {
    it('should merge and save new password hash', async () => {
      mockUserRepository.merge.mockReturnValue(undefined);
      mockUserRepository.save.mockResolvedValue(undefined);

      await service.updatePassword(mockUser as UserEntity, {
        passwordHash: 'new-hash',
      });

      expect(mockUserRepository.merge).toHaveBeenCalledWith(mockUser, {
        passwordHash: 'new-hash',
      });
      expect(mockUserRepository.save).toHaveBeenCalled();
    });
  });
});
