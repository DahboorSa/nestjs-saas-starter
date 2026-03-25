import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';

const mockUserService = {
  getDetails: jest.fn(),
  update: jest.fn(),
  changeEmail: jest.fn(),
  confirmEmailChange: jest.fn(),
};

const auditContext = { ipAddress: '127.0.0.1', userAgent: 'jest' } as any;
const userInfo = {
  userId: 'user-1',
  orgId: 'org-1',
  email: 'user@example.com',
} as any;

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: mockUserService }],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── GET /users/me ────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return current user details', async () => {
      const expected = {
        id: 'user-1',
        email: 'user@example.com',
        firstName: 'John',
      };
      mockUserService.getDetails.mockResolvedValue(expected);

      const result = await controller.findAll(userInfo);

      expect(result).toEqual(expected);
      expect(mockUserService.getDetails).toHaveBeenCalledWith(userInfo);
    });
  });

  // ─── PATCH /users/me ──────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update and return user', async () => {
      const body = { firstName: 'Jane' } as any;
      const expected = { id: 'user-1', firstName: 'Jane' };
      mockUserService.update.mockResolvedValue(expected);

      const result = await controller.update(auditContext, userInfo, body);

      expect(result).toEqual(expected);
      expect(mockUserService.update).toHaveBeenCalledWith(
        auditContext,
        userInfo,
        body,
      );
    });
  });

  // ─── POST /users/me/email ─────────────────────────────────────────────────────

  describe('changeEmail', () => {
    it('should request email change', async () => {
      const body = { email: 'new@example.com' } as any;
      const expected = { message: 'Confirmation email sent' };
      mockUserService.changeEmail.mockResolvedValue(expected);

      const result = await controller.changeEmail(userInfo, body);

      expect(result).toEqual(expected);
      expect(mockUserService.changeEmail).toHaveBeenCalledWith(userInfo, body);
    });
  });

  // ─── POST /users/me/email/confirm ─────────────────────────────────────────────

  describe('confirmEmail', () => {
    it('should confirm email change and return new tokens', async () => {
      const expected = {
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
      };
      mockUserService.confirmEmailChange.mockResolvedValue(expected);

      const result = await controller.confirmEmail(
        auditContext,
        'confirm-token',
      );

      expect(result).toEqual(expected);
      expect(mockUserService.confirmEmailChange).toHaveBeenCalledWith(
        auditContext,
        'confirm-token',
      );
    });
  });
});
