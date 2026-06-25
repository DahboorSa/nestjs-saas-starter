import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';
import { AuditAction, AuditResourceType, UserRole } from '../../enums';
import { UserInfoDto } from '../../common/dto';

const mockAuditLogService = {
  findByOrganization: jest.fn(),
};

const mockUser: UserInfoDto = {
  userId: 'user-1',
  orgId: 'org-1',
  email: 'owner@test.com',
  role: UserRole.OWNER,
};

describe('AuditLogController', () => {
  let controller: AuditLogController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogController],
      providers: [{ provide: AuditLogService, useValue: mockAuditLogService }],
    }).compile();

    controller = module.get<AuditLogController>(AuditLogController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── GET /audit-logs ──────────────────────────────────────────────────────────

  describe('getAuditLogs', () => {
    it('calls findByOrganization with orgId and no dates when no query params', async () => {
      mockAuditLogService.findByOrganization.mockResolvedValue([]);

      await controller.getAuditLogs(mockUser);

      expect(mockAuditLogService.findByOrganization).toHaveBeenCalledWith(
        'org-1',
        undefined,
        undefined,
      );
    });

    it('passes from query param to the service', async () => {
      mockAuditLogService.findByOrganization.mockResolvedValue([]);

      await controller.getAuditLogs(mockUser, '2024-01-01');

      expect(mockAuditLogService.findByOrganization).toHaveBeenCalledWith(
        'org-1',
        '2024-01-01',
        undefined,
      );
    });

    it('passes both from and to query params to the service', async () => {
      mockAuditLogService.findByOrganization.mockResolvedValue([]);

      await controller.getAuditLogs(mockUser, '2024-01-01', '2024-01-31');

      expect(mockAuditLogService.findByOrganization).toHaveBeenCalledWith(
        'org-1',
        '2024-01-01',
        '2024-01-31',
      );
    });

    it('returns the result from the service', async () => {
      const logs = [
        {
          action: AuditAction.API_KEY_CREATED,
          resourceType: AuditResourceType.API_KEY,
          resourceId: 'key-1',
          metadata: {},
          createdAt: new Date(),
        },
      ];
      mockAuditLogService.findByOrganization.mockResolvedValue(logs);

      const result = await controller.getAuditLogs(mockUser);

      expect(result).toEqual(logs);
    });

    it('uses the orgId from the current user, not a hardcoded value', async () => {
      const otherUser: UserInfoDto = { ...mockUser, orgId: 'org-99' };
      mockAuditLogService.findByOrganization.mockResolvedValue([]);

      await controller.getAuditLogs(otherUser);

      expect(mockAuditLogService.findByOrganization).toHaveBeenCalledWith(
        'org-99',
        undefined,
        undefined,
      );
    });
  });
});
