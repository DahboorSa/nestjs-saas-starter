import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { OrganizationService } from '../organizations/organization.service';
import { UserService } from '../users/user.service';
import { PlanService } from '../plans/plan.service';
import { DataSource } from 'typeorm';
import { CacheService } from '../../cache/cache.service';
import { EmailQueueService } from '../../jobs/queues/email.queue';
import { SubscriptionQueueService } from '../../jobs/queues/subscription.queue';
import { ConfigService } from '@nestjs/config';
import { UtilityService } from '../../common/utils/utility.service';
import { JwtUtilityService } from '../../common/utils/jwt-utility.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditAction, UserRole } from '../../enums';
import * as argon from 'argon2';
import { hashToken } from '../../common/utils/hash-token.util';

jest.mock('argon2');

const mockOrganizationService = { getBySlug: jest.fn() };
const mockUserService = {
  getByEmail: jest.fn(),
  getById: jest.fn(),
  preload: jest.fn(),
  updateLastLogin: jest.fn(),
  updatePassword: jest.fn(),
};
const mockPlanService = { getByName: jest.fn() };
const mockDataSource = { transaction: jest.fn() };
const mockCacheService = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
const mockEmailQueueService = { add: jest.fn() };
const mockSubscriptionQueueService = { add: jest.fn() };
const mockConfigService = { get: jest.fn().mockReturnValue(604800) };
const mockUtilityService = {
  generateSlug: jest.fn(),
  getTrialEndDate: jest.fn(),
};
const mockJwtUtilityService = {
  issueTokenPair: jest.fn().mockResolvedValue({
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  }),
  verifyRefreshToken: jest.fn(),
};
const mockAuditLogService = { create: jest.fn().mockResolvedValue(undefined) };

const auditContext = { ipAddress: '127.0.0.1', userAgent: 'jest' };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAuditLogService.create.mockResolvedValue(undefined);
    mockConfigService.get.mockReturnValue(604800);
    mockJwtUtilityService.issueTokenPair.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: UserService, useValue: mockUserService },
        { provide: PlanService, useValue: mockPlanService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: CacheService, useValue: mockCacheService },
        { provide: EmailQueueService, useValue: mockEmailQueueService },
        {
          provide: SubscriptionQueueService,
          useValue: mockSubscriptionQueueService,
        },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UtilityService, useValue: mockUtilityService },
        { provide: JwtUtilityService, useValue: mockJwtUtilityService },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto = {
      name: 'Test Org',
      email: 'test@example.com',
      password: 'Password123!',
      plan: 'Free',
    };

    beforeEach(() => {
      mockUtilityService.generateSlug.mockReturnValue('test-org');
      mockOrganizationService.getBySlug.mockResolvedValue(null);
    });

    describe('email already registered', () => {
      const freePlan = { id: 1, name: 'Free', trialDays: 0 };

      beforeEach(() => {
        mockPlanService.getByName.mockResolvedValue(freePlan);
        (argon.hash as jest.Mock).mockResolvedValue('hashed-password');
        mockEmailQueueService.add.mockResolvedValue(undefined);
      });

      it('should respond like a new registration, create nothing and notify the owner', async () => {
        mockUserService.getByEmail.mockResolvedValue({
          id: 'user-1',
          isActive: true,
        });

        const result = await service.register(
          auditContext as any,
          registerDto as any,
        );

        expect(Object.keys(result)).toEqual(['message']);
        expect(mockDataSource.transaction).not.toHaveBeenCalled();
        expect(mockSubscriptionQueueService.add).not.toHaveBeenCalled();
        expect(mockEmailQueueService.add).toHaveBeenCalledWith(
          'account-exists.email',
          { email: registerDto.email, userId: 'user-1' },
        );
      });

      it('should return the identical response for existing and new emails', async () => {
        mockUserService.getByEmail.mockResolvedValue({
          id: 'user-1',
          isActive: true,
        });
        const existing = await service.register(
          auditContext as any,
          registerDto as any,
        );

        mockUserService.getByEmail.mockResolvedValue(null);
        mockCacheService.set.mockResolvedValue(undefined);
        mockSubscriptionQueueService.add.mockResolvedValue(undefined);
        mockDataSource.transaction.mockImplementation(async (cb) =>
          cb({
            getRepository: jest.fn().mockReturnValue({
              save: jest
                .fn()
                .mockResolvedValueOnce({ id: 'org-1' })
                .mockResolvedValueOnce({ id: 'user-2' }),
            }),
          }),
        );
        const created = await service.register(
          auditContext as any,
          registerDto as any,
        );

        expect(created).toEqual(existing);
      });

      it('should still hash the password so timing stays close to a new signup', async () => {
        mockUserService.getByEmail.mockResolvedValue({
          id: 'user-1',
          isActive: true,
        });

        await service.register(auditContext as any, registerDto as any);

        expect(argon.hash).toHaveBeenCalledWith(registerDto.password);
      });

      it('should respond the same but send no email for a deactivated account', async () => {
        mockUserService.getByEmail.mockResolvedValue({
          id: 'user-1',
          isActive: false,
        });

        const result = await service.register(
          auditContext as any,
          registerDto as any,
        );

        expect(Object.keys(result)).toEqual(['message']);
        expect(mockDataSource.transaction).not.toHaveBeenCalled();
        expect(mockEmailQueueService.add).not.toHaveBeenCalled();
      });

      it('should look the email up lowercased, as it is stored', async () => {
        mockUserService.getByEmail.mockResolvedValue({
          id: 'user-1',
          isActive: true,
        });

        await service.register(
          auditContext as any,
          {
            ...registerDto,
            email: 'Test@Example.COM',
          } as any,
        );

        expect(mockUserService.getByEmail).toHaveBeenCalledWith(
          'test@example.com',
        );
      });

      it('should fail the same way for a bad plan whether or not the email exists', async () => {
        mockPlanService.getByName.mockResolvedValue(null);
        mockUserService.getByEmail.mockResolvedValue({
          id: 'user-1',
          isActive: true,
        });

        await expect(
          service.register(auditContext as any, registerDto as any),
        ).rejects.toThrow(InternalServerErrorException);
        expect(mockUserService.getByEmail).not.toHaveBeenCalled();
      });
    });

    it('should throw InternalServerErrorException if plan not found', async () => {
      mockUserService.getByEmail.mockResolvedValue(null);
      mockPlanService.getByName.mockResolvedValue(null);

      await expect(
        service.register(auditContext as any, registerDto as any),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should register user successfully', async () => {
      mockUserService.getByEmail.mockResolvedValue(null);
      mockPlanService.getByName.mockResolvedValue({
        id: 1,
        name: 'Free',
        trialDays: 0,
      });
      (argon.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockCacheService.set.mockResolvedValue(undefined);
      mockEmailQueueService.add.mockResolvedValue(undefined);
      mockSubscriptionQueueService.add.mockResolvedValue(undefined);

      const mockOrg = { id: 'org-1' };
      const mockUser = { id: 'user-1' };

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const manager = {
          getRepository: jest.fn().mockReturnValue({
            save: jest
              .fn()
              .mockResolvedValueOnce(mockOrg)
              .mockResolvedValueOnce(mockUser),
          }),
        };
        return cb(manager);
      });

      const result = await service.register(
        auditContext as any,
        registerDto as any,
      );

      expect(result).toEqual({ message: expect.any(String) });
      expect(mockEmailQueueService.add).toHaveBeenCalledWith('welcome.email', {
        token: expect.any(String),
        email: registerDto.email,
        userId: 'user-1',
      });
      expect(mockSubscriptionQueueService.add).toHaveBeenCalledWith(
        'subscription.create',
        {
          email: registerDto.email,
          orgId: 'org-1',
        },
      );
    });

    it('should still return success if enqueuing background jobs fails after commit', async () => {
      mockUserService.getByEmail.mockResolvedValue(null);
      mockPlanService.getByName.mockResolvedValue({
        id: 1,
        name: 'Free',
        trialDays: 0,
      });
      (argon.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockCacheService.set.mockResolvedValue(undefined);
      mockEmailQueueService.add.mockRejectedValue(new Error('Redis down'));
      mockSubscriptionQueueService.add.mockRejectedValue(
        new Error('Redis down'),
      );

      const mockOrg = { id: 'org-1' };
      const mockUser = { id: 'user-1' };

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const manager = {
          getRepository: jest.fn().mockReturnValue({
            save: jest
              .fn()
              .mockResolvedValueOnce(mockOrg)
              .mockResolvedValueOnce(mockUser),
          }),
        };
        return cb(manager);
      });

      const result = await service.register(
        auditContext as any,
        registerDto as any,
      );

      expect(result).toEqual({ message: expect.any(String) });
    });
  });

  describe('verifyEmail', () => {
    it('should throw UnauthorizedException if token is invalid or expired', async () => {
      mockCacheService.get.mockResolvedValue(null);

      await expect(
        service.verifyEmail(auditContext as any, 'invalid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should verify email successfully', async () => {
      mockCacheService.get.mockResolvedValue(
        JSON.stringify({ userId: 'user-1', orgId: 'org-1' }),
      );
      mockUserService.preload.mockResolvedValue({
        id: 'user-1',
        isVerified: true,
      });
      mockCacheService.delete.mockResolvedValue(undefined);

      const result = await service.verifyEmail(
        auditContext as any,
        'valid-token',
      );

      expect(result).toEqual({
        message: 'Email verified successfully',
        userId: 'user-1',
        isVerified: true,
      });
      expect(mockCacheService.delete).toHaveBeenCalledWith(
        `verify:email:${hashToken('valid-token')}`,
      );
    });
  });

  describe('login', () => {
    const loginDto = { email: 'test@example.com', password: 'Password123!' };
    const mockUser = {
      id: 'user-1',
      passwordHash: 'hashed',
      isVerified: true,
      isActive: true,
      role: UserRole.OWNER,
      email: 'test@example.com',
      organization: { id: 'org-1' },
    };

    it('should throw UnauthorizedException if user not found', async () => {
      mockUserService.getByEmail.mockResolvedValue(null);

      await expect(
        service.login(auditContext as any, loginDto),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockAuditLogService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.AUTH_LOGIN_FAILED,
          resourceId: 'unknown',
          metadata: { reason: 'unknown_user' },
          user: undefined,
          organization: undefined,
        }),
      );
    });

    it('should spend an argon2 verification on an unknown email so timing matches a wrong password', async () => {
      mockUserService.getByEmail.mockResolvedValue(null);
      (argon.hash as jest.Mock).mockResolvedValue('dummy-hash');
      (argon.verify as jest.Mock).mockClear();

      await expect(
        service.login(auditContext as any, loginDto),
      ).rejects.toThrow(UnauthorizedException);

      // The dummy hash is cached module-wide, so only its use is asserted.
      expect(argon.verify).toHaveBeenCalledTimes(1);
      expect((argon.verify as jest.Mock).mock.calls[0][1]).toBe(
        loginDto.password,
      );
    });

    it('should never store the submitted email in the failure audit', async () => {
      mockUserService.getByEmail.mockResolvedValue(null);

      await expect(
        service.login(auditContext as any, loginDto),
      ).rejects.toThrow(UnauthorizedException);

      expect(
        JSON.stringify(mockAuditLogService.create.mock.calls),
      ).not.toContain(loginDto.email);
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      mockUserService.getByEmail.mockResolvedValue(mockUser);
      (argon.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login(auditContext as any, loginDto),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockAuditLogService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.AUTH_LOGIN_FAILED,
          resourceId: 'user-1',
          metadata: { reason: 'invalid_password' },
          user: mockUser,
          organization: mockUser.organization,
        }),
      );
    });

    it('should throw ForbiddenException if email is not verified', async () => {
      mockUserService.getByEmail.mockResolvedValue({
        ...mockUser,
        isVerified: false,
      });
      (argon.verify as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login(auditContext as any, loginDto),
      ).rejects.toThrow(ForbiddenException);

      expect(mockAuditLogService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.AUTH_LOGIN_FAILED,
          metadata: { reason: 'email_not_verified' },
        }),
      );
    });

    it('should throw ForbiddenException if account is deactivated', async () => {
      mockUserService.getByEmail.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });
      (argon.verify as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login(auditContext as any, loginDto),
      ).rejects.toThrow(ForbiddenException);

      expect(mockAuditLogService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.AUTH_LOGIN_FAILED,
          metadata: { reason: 'account_deactivated' },
        }),
      );
    });

    it('should still reject with 401 if the failure audit write fails', async () => {
      mockUserService.getByEmail.mockResolvedValue(mockUser);
      (argon.verify as jest.Mock).mockResolvedValue(false);
      mockAuditLogService.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.login(auditContext as any, loginDto),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return tokens on successful login', async () => {
      mockUserService.getByEmail.mockResolvedValue(mockUser);
      (argon.verify as jest.Mock).mockResolvedValue(true);
      mockCacheService.set.mockResolvedValue(undefined);
      mockUserService.updateLastLogin.mockResolvedValue(undefined);

      const result = await service.login(auditContext as any, loginDto);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(mockAuditLogService.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.AUTH_LOGIN_FAILED }),
      );
    });
  });

  describe('refresh', () => {
    const tokenPayload = {
      userId: 'user-1',
      orgId: 'org-1',
      email: 'test@example.com',
      role: UserRole.OWNER,
    };
    const mockUser = { isActive: true, organization: { id: 'org-1' } };

    it('should throw UnauthorizedException if user not found', async () => {
      mockJwtUtilityService.verifyRefreshToken.mockReturnValue(tokenPayload);
      mockUserService.getById.mockResolvedValue(null);

      await expect(
        service.refresh(auditContext as any, 'token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is deactivated', async () => {
      mockJwtUtilityService.verifyRefreshToken.mockReturnValue(tokenPayload);
      mockUserService.getById.mockResolvedValue({ isActive: false });

      await expect(
        service.refresh(auditContext as any, 'token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is logged out', async () => {
      mockJwtUtilityService.verifyRefreshToken.mockReturnValue(tokenPayload);
      mockUserService.getById.mockResolvedValue(mockUser);
      mockCacheService.get.mockResolvedValue(null);

      await expect(
        service.refresh(auditContext as any, 'token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if token was already rotated', async () => {
      mockJwtUtilityService.verifyRefreshToken.mockReturnValue(tokenPayload);
      mockUserService.getById.mockResolvedValue(mockUser);
      mockCacheService.get.mockResolvedValue('different-token');

      await expect(
        service.refresh(auditContext as any, 'token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return new token pair on successful refresh', async () => {
      mockJwtUtilityService.verifyRefreshToken.mockReturnValue(tokenPayload);
      mockUserService.getById.mockResolvedValue(mockUser);
      mockCacheService.get.mockResolvedValue(hashToken('token'));
      mockCacheService.delete.mockResolvedValue(undefined);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.refresh(auditContext as any, 'token');

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(mockCacheService.delete).toHaveBeenCalledWith(
        'auth:refresh:user-1',
      );
    });
  });

  describe('changePassword', () => {
    const currentUser = {
      email: 'test@example.com',
      userId: 'user-1',
      orgId: 'org-1',
      role: UserRole.OWNER,
    };
    const mockUser = {
      id: 'user-1',
      passwordHash: 'hashed',
      organization: { id: 'org-1' },
    };

    it('should throw UnauthorizedException if user not found', async () => {
      mockUserService.getByEmail.mockResolvedValue(null);

      await expect(
        service.changePassword(auditContext as any, currentUser as any, {
          oldPassword: 'Old123!',
          password: 'New123!',
          confirmPassword: 'New123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if old password is invalid', async () => {
      mockUserService.getByEmail.mockResolvedValue(mockUser);
      (argon.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(auditContext as any, currentUser as any, {
          oldPassword: 'Wrong123!',
          password: 'New123!',
          confirmPassword: 'New123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException if new password is same as old', async () => {
      mockUserService.getByEmail.mockResolvedValue(mockUser);
      (argon.verify as jest.Mock)
        .mockResolvedValueOnce(true) // old password valid
        .mockResolvedValueOnce(true); // same as new

      await expect(
        service.changePassword(auditContext as any, currentUser as any, {
          oldPassword: 'Password123!',
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if passwords do not match', async () => {
      mockUserService.getByEmail.mockResolvedValue(mockUser);
      (argon.verify as jest.Mock)
        .mockResolvedValueOnce(true) // old password valid
        .mockResolvedValueOnce(false); // not same as new

      await expect(
        service.changePassword(auditContext as any, currentUser as any, {
          oldPassword: 'OldPass123!',
          password: 'NewPass123!',
          confirmPassword: 'DifferentPass123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return tokens on successful password change', async () => {
      mockUserService.getByEmail.mockResolvedValue(mockUser);
      (argon.verify as jest.Mock)
        .mockResolvedValueOnce(true) // old password valid
        .mockResolvedValueOnce(false); // not same as new
      (argon.hash as jest.Mock).mockResolvedValue('new-hashed');
      mockUserService.updatePassword.mockResolvedValue(undefined);
      mockUserService.updateLastLogin.mockResolvedValue(undefined);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.changePassword(
        auditContext as any,
        currentUser as any,
        {
          oldPassword: 'OldPass123!',
          password: 'NewPass123!',
          confirmPassword: 'NewPass123!',
        },
      );

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });
  });

  describe('forgotPassword', () => {
    it('should always return a generic message', async () => {
      mockUserService.getByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword(auditContext as any, {
        email: 'test@example.com',
      });

      expect(result.message).toBeDefined();
    });

    it('should send reset email if user exists', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        organization: { id: 'org-1' },
      };
      mockUserService.getByEmail.mockResolvedValue(mockUser);
      mockCacheService.set.mockResolvedValue(undefined);
      mockEmailQueueService.add.mockResolvedValue(undefined);

      await service.forgotPassword(auditContext as any, {
        email: 'test@example.com',
      });

      expect(mockEmailQueueService.add).toHaveBeenCalledWith(
        'forgot-password.email',
        expect.any(Object),
      );
    });

    it('should store only the hash of the reset token in Redis', async () => {
      mockUserService.getByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        organization: { id: 'org-1' },
      });
      mockCacheService.set.mockResolvedValue(undefined);
      mockEmailQueueService.add.mockResolvedValue(undefined);

      await service.forgotPassword(auditContext as any, {
        email: 'test@example.com',
      });

      const { token } = mockEmailQueueService.add.mock.calls[0][1];
      const [key] = mockCacheService.set.mock.calls[0];
      expect(key).toBe(`reset:password:${hashToken(token)}`);
      expect(key).not.toContain(token);
    });
  });

  describe('resetPassword', () => {
    const tokenData = JSON.stringify({
      userId: 'user-1',
      orgId: 'org-1',
      email: 'test@example.com',
    });
    const mockUser = {
      isActive: true,
      passwordHash: 'hashed',
      role: UserRole.OWNER,
      organization: { id: 'org-1' },
    };

    it('should throw UnauthorizedException if token is invalid or expired', async () => {
      mockCacheService.get.mockResolvedValue(null);

      await expect(
        service.resetPassword(auditContext as any, {
          token: 'invalid',
          password: 'NewPass123!',
          confirmPassword: 'NewPass123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockCacheService.get.mockResolvedValue(tokenData);
      mockUserService.getByEmail.mockResolvedValue(null);

      await expect(
        service.resetPassword(auditContext as any, {
          token: 'valid',
          password: 'NewPass123!',
          confirmPassword: 'NewPass123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException if new password is same as old', async () => {
      mockCacheService.get.mockResolvedValue(tokenData);
      mockUserService.getByEmail.mockResolvedValue(mockUser);
      (argon.verify as jest.Mock).mockResolvedValue(true);

      await expect(
        service.resetPassword(auditContext as any, {
          token: 'valid',
          password: 'SamePass123!',
          confirmPassword: 'SamePass123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if passwords do not match', async () => {
      mockCacheService.get.mockResolvedValue(tokenData);
      mockUserService.getByEmail.mockResolvedValue(mockUser);
      (argon.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.resetPassword(auditContext as any, {
          token: 'valid',
          password: 'NewPass123!',
          confirmPassword: 'DifferentPass123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return tokens on successful password reset', async () => {
      mockCacheService.get.mockResolvedValue(tokenData);
      mockUserService.getByEmail.mockResolvedValue(mockUser);
      (argon.verify as jest.Mock).mockResolvedValue(false);
      (argon.hash as jest.Mock).mockResolvedValue('new-hashed');
      mockUserService.updatePassword.mockResolvedValue(undefined);
      mockCacheService.set.mockResolvedValue(undefined);
      mockCacheService.delete.mockResolvedValue(undefined);

      const result = await service.resetPassword(auditContext as any, {
        token: 'valid',
        password: 'NewPass123!',
        confirmPassword: 'NewPass123!',
      });

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });
  });

  describe('resendVerifyEmail', () => {
    it('should always return a generic message', async () => {
      mockUserService.getByEmail.mockResolvedValue(null);

      const result = await service.resendVerifyEmail(auditContext as any, {
        email: 'test@example.com',
      });

      expect(result.message).toBeDefined();
    });

    it('should send email if user exists, is active and unverified', async () => {
      const mockUser = {
        id: 'user-1',
        isActive: true,
        isVerified: false,
        organization: { id: 'org-1' },
      };
      mockUserService.getByEmail.mockResolvedValue(mockUser);
      mockCacheService.set.mockResolvedValue(undefined);
      mockEmailQueueService.add.mockResolvedValue(undefined);

      await service.resendVerifyEmail(auditContext as any, {
        email: 'test@example.com',
      });

      expect(mockEmailQueueService.add).toHaveBeenCalledWith(
        'resend-verify.email',
        expect.any(Object),
      );
    });

    it('should not send email if user is already verified', async () => {
      mockUserService.getByEmail.mockResolvedValue({
        isActive: true,
        isVerified: true,
        organization: { id: 'org-1' },
      });

      await service.resendVerifyEmail(auditContext as any, {
        email: 'test@example.com',
      });

      expect(mockEmailQueueService.add).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should logout successfully and blacklist the token', async () => {
      const user = {
        userId: 'user-1',
        token: 'jti-token',
        orgId: 'org-1',
        expiresIn: Math.floor(Date.now() / 1000) + 900,
      };
      mockCacheService.delete.mockResolvedValue(undefined);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.logout(auditContext as any, user as any);

      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(mockCacheService.delete).toHaveBeenCalledWith(
        'auth:refresh:user-1',
      );
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `auth:blacklist:${hashToken('jti-token')}`,
        '1',
        expect.any(Number),
      );
    });

    it('should not blacklist token if it is already expired', async () => {
      const user = {
        userId: 'user-1',
        token: 'jti-token',
        orgId: 'org-1',
        expiresIn: Math.floor(Date.now() / 1000) - 100, // already expired
      };
      mockCacheService.delete.mockResolvedValue(undefined);

      await service.logout(auditContext as any, user as any);

      expect(mockCacheService.set).not.toHaveBeenCalled();
    });
  });
});
