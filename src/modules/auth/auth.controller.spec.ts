import { Test, TestingModule } from '@nestjs/testing';
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
      const expected = { accessToken: 'token', refreshToken: 'refresh' };
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
    it('should call authService.login and return tokens', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'Password123!',
      } as any;
      const expected = { accessToken: 'token', refreshToken: 'refresh' };
      mockAuthService.login.mockResolvedValue(expected);

      const result = await controller.login(auditContext, dto);

      expect(result).toEqual(expected);
      expect(mockAuthService.login).toHaveBeenCalledWith(auditContext, dto);
    });
  });

  // ─── refresh ──────────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('should call authService.refresh and return new tokens', async () => {
      const body = { refreshToken: 'old-refresh' } as any;
      const expected = {
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
      };
      mockAuthService.refresh.mockResolvedValue(expected);

      const result = await controller.refresh(auditContext, body);

      expect(result).toEqual(expected);
      expect(mockAuthService.refresh).toHaveBeenCalledWith(auditContext, body);
    });
  });

  // ─── changePassword ───────────────────────────────────────────────────────────

  describe('changePassword', () => {
    it('should call authService.changePassword', async () => {
      const body = { currentPassword: 'old', newPassword: 'New123!' } as any;
      const expected = { message: 'Password changed' };
      mockAuthService.changePassword.mockResolvedValue(expected);

      const result = await controller.changePassword(
        auditContext,
        userInfo,
        body,
      );

      expect(result).toEqual(expected);
      expect(mockAuthService.changePassword).toHaveBeenCalledWith(
        auditContext,
        userInfo,
        body,
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
    it('should call authService.resetPassword', async () => {
      const body = { token: 'reset-token', password: 'New123!' } as any;
      const expected = { message: 'Password reset successfully' };
      mockAuthService.resetPassword.mockResolvedValue(expected);

      const result = await controller.resetPassword(auditContext, body);

      expect(result).toEqual(expected);
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(
        auditContext,
        body,
      );
    });
  });

  // ─── logout ───────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('should call authService.logout', async () => {
      const expected = { message: 'Logged out successfully' };
      mockAuthService.logout.mockResolvedValue(expected);

      const result = await controller.logout(auditContext, userInfo);

      expect(result).toEqual(expected);
      expect(mockAuthService.logout).toHaveBeenCalledWith(
        auditContext,
        userInfo,
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
