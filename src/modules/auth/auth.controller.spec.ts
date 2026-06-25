import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const mockAuthService = {
  register: jest.fn(),
  verifyEmail: jest.fn(),
  login: jest.fn(),
  refresh: jest.fn(),
  changePassword: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
  logout: jest.fn(),
  resendVerifyEmail: jest.fn(),
};

const auditContext = { ipAddress: '127.0.0.1', userAgent: 'jest' } as any;
const userInfo = { userId: 'user-1', orgId: 'org-1' } as any;

const mockRes = () => ({ cookie: jest.fn(), clearCookie: jest.fn() });
const mockReq = (cookies: Record<string, string> = {}) => ({ cookies });

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── register ─────────────────────────────────────────────────────────────────

  describe('register', () => {
    it('should call authService.register and return result', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'Password123!',
      } as any;
      const expected = {
        message: 'Registration successful',
        userId: 'u1',
        organizationId: 'o1',
      };
      mockAuthService.register.mockResolvedValue(expected);

      const result = await controller.register(auditContext, dto);

      expect(result).toEqual(expected);
      expect(mockAuthService.register).toHaveBeenCalledWith(auditContext, dto);
    });
  });

  // ─── verifyEmail ──────────────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    it('should call authService.verifyEmail with token', async () => {
      const expected = { message: 'Email verified' };
      mockAuthService.verifyEmail.mockResolvedValue(expected);

      const result = await controller.verifyEmail(auditContext, 'abc123');

      expect(result).toEqual(expected);
      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith(
        auditContext,
        'abc123',
      );
    });
  });

  // ─── login ────────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('should set refresh cookie and return only accessToken', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'Password123!',
      } as any;
      const res = mockRes();
      mockAuthService.login.mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'refresh',
      });

      const result = await controller.login(auditContext, dto, res as any);

      expect(result).toEqual({ accessToken: 'token' });
      expect(mockAuthService.login).toHaveBeenCalledWith(auditContext, dto);
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh',
        expect.any(Object),
      );
    });
  });

  // ─── refresh ──────────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('should read cookie, rotate it, and return new accessToken', async () => {
      const req = mockReq({ refreshToken: 'old-refresh' });
      const res = mockRes();
      mockAuthService.refresh.mockResolvedValue({
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
      });

      const result = await controller.refresh(
        auditContext,
        req as any,
        res as any,
      );

      expect(result).toEqual({ accessToken: 'new-token' });
      expect(mockAuthService.refresh).toHaveBeenCalledWith(
        auditContext,
        'old-refresh',
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'new-refresh',
        expect.any(Object),
      );
    });

    it('should throw UnauthorizedException when cookie is missing', async () => {
      const req = mockReq({});
      const res = mockRes();

      await expect(
        controller.refresh(auditContext, req as any, res as any),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── changePassword ───────────────────────────────────────────────────────────

  describe('changePassword', () => {
    it('should call authService.changePassword, set cookie, and return accessToken', async () => {
      const body = {
        oldPassword: 'Old123!',
        password: 'New123!',
        confirmPassword: 'New123!',
      } as any;
      const res = mockRes();
      mockAuthService.changePassword.mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'refresh',
      });

      const result = await controller.changePassword(
        auditContext,
        userInfo,
        body,
        res as any,
      );

      expect(result).toEqual({ accessToken: 'token' });
      expect(mockAuthService.changePassword).toHaveBeenCalledWith(
        auditContext,
        userInfo,
        body,
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh',
        expect.any(Object),
      );
    });
  });

  // ─── forgotPassword ───────────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('should call authService.forgotPassword', async () => {
      const body = { email: 'test@example.com' } as any;
      const expected = {
        message: 'If that email exists, a reset link was sent',
      };
      mockAuthService.forgotPassword.mockResolvedValue(expected);

      const result = await controller.forgotPassword(auditContext, body);

      expect(result).toEqual(expected);
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(
        auditContext,
        body,
      );
    });
  });

  // ─── resetPassword ───────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('should call authService.resetPassword, set cookie, and return accessToken', async () => {
      const body = {
        token: 'reset-token',
        password: 'New123!',
        confirmPassword: 'New123!',
      } as any;
      const res = mockRes();
      mockAuthService.resetPassword.mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'refresh',
      });

      const result = await controller.resetPassword(
        auditContext,
        body,
        res as any,
      );

      expect(result).toEqual({ accessToken: 'token' });
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(
        auditContext,
        body,
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh',
        expect.any(Object),
      );
    });
  });

  // ─── logout ───────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('should clear refresh cookie and call authService.logout', async () => {
      const res = mockRes();
      const expected = { message: 'Logged out successfully' };
      mockAuthService.logout.mockResolvedValue(expected);

      const result = await controller.logout(
        auditContext,
        userInfo,
        res as any,
      );

      expect(result).toEqual(expected);
      expect(mockAuthService.logout).toHaveBeenCalledWith(
        auditContext,
        userInfo,
      );
      expect(res.clearCookie).toHaveBeenCalledWith(
        'refreshToken',
        expect.any(Object),
      );
    });
  });

  // ─── resendVerifyEmail ────────────────────────────────────────────────────────

  describe('resendVerifyEmail', () => {
    it('should call authService.resendVerifyEmail', async () => {
      const body = { email: 'test@example.com' } as any;
      const expected = {
        message: 'If that email is registered, a verification link was sent',
      };
      mockAuthService.resendVerifyEmail.mockResolvedValue(expected);

      const result = await controller.resendVerifyEmail(auditContext, body);

      expect(result).toEqual(expected);
      expect(mockAuthService.resendVerifyEmail).toHaveBeenCalledWith(
        auditContext,
        body,
      );
    });
  });
});
