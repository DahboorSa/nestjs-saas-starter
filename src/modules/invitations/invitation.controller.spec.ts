import { Test, TestingModule } from '@nestjs/testing';
import { InvitationController } from './invitation.controller';
import { InvitationService } from './invitation.service';
import { MemberInviteTrackerInterceptor } from './interceptors/member-invite-tracker.interceptor';
import { InvitationStatus, UserRole } from '../../enums';

const mockInvitationService = {
  getList: jest.fn(),
  send: jest.fn(),
  acceptInvitation: jest.fn(),
};

const auditContext = { ipAddress: '127.0.0.1', userAgent: 'jest' } as any;
const userInfo = {
  userId: 'user-1',
  orgId: 'org-1',
  role: UserRole.OWNER,
} as any;

const mockInvitation = {
  id: 1,
  email: 'invite@example.com',
  role: UserRole.MEMBER,
  status: InvitationStatus.PENDING,
};

describe('InvitationController', () => {
  let controller: InvitationController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvitationController],
      providers: [
        { provide: InvitationService, useValue: mockInvitationService },
      ],
    })
      .overrideInterceptor(MemberInviteTrackerInterceptor)
      .useValue({ intercept: jest.fn((_ctx, next) => next.handle()) })
      .compile();

    controller = module.get<InvitationController>(InvitationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── GET /invitations ─────────────────────────────────────────────────────────

  describe('getList', () => {
    it('should return pending invitations by default', async () => {
      mockInvitationService.getList.mockResolvedValue([mockInvitation]);

      const result = await controller.getList(
        userInfo,
        InvitationStatus.PENDING,
      );

      expect(result).toEqual([mockInvitation]);
      expect(mockInvitationService.getList).toHaveBeenCalledWith(
        userInfo,
        InvitationStatus.PENDING,
      );
    });

    it('should return accepted invitations when status is ACCEPTED', async () => {
      const accepted = { ...mockInvitation, status: InvitationStatus.ACCEPTED };
      mockInvitationService.getList.mockResolvedValue([accepted]);

      const result = await controller.getList(
        userInfo,
        InvitationStatus.ACCEPTED,
      );

      expect(result).toEqual([accepted]);
      expect(mockInvitationService.getList).toHaveBeenCalledWith(
        userInfo,
        InvitationStatus.ACCEPTED,
      );
    });
  });

  // ─── POST /invitations ────────────────────────────────────────────────────────

  describe('sendInvitations', () => {
    it('should send invitation and return success message', async () => {
      const body = {
        email: 'invite@example.com',
        role: UserRole.MEMBER,
      } as any;
      const expected = { message: 'Invitation sent successfully' };
      mockInvitationService.send.mockResolvedValue(expected);

      const result = await controller.sendInvitations(
        auditContext,
        userInfo,
        body,
      );

      expect(result).toEqual(expected);
      expect(mockInvitationService.send).toHaveBeenCalledWith(
        auditContext,
        userInfo,
        body,
      );
    });
  });

  // ─── POST /invitations/accept ─────────────────────────────────────────────────

  describe('acceptInvitation', () => {
    it('should accept invitation and return tokens', async () => {
      const body = {
        password: 'Password123!',
        firstName: 'Jane',
        lastName: 'Doe',
      } as any;
      const expected = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };
      mockInvitationService.acceptInvitation.mockResolvedValue(expected);

      const result = await controller.acceptInvitation(
        auditContext,
        'valid-token',
        body,
      );

      expect(result).toEqual(expected);
      expect(mockInvitationService.acceptInvitation).toHaveBeenCalledWith(
        auditContext,
        'valid-token',
        body,
      );
    });
  });
});
