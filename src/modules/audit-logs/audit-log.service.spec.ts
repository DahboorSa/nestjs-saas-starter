import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from './audit-log.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogEntity } from './entities/audit-log.entity';
import { AuditAction, AuditResourceType } from '../../enums';

const mockAuditLogRepository = {
  create: jest.fn(),
  save: jest.fn(),
};

describe('AuditLogService', () => {
  let service: AuditLogService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: getRepositoryToken(AuditLogEntity),
          useValue: mockAuditLogRepository,
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── create ───────────────────────────────────────────────────────────────────

  describe('create', () => {
    const auditLogData = {
      action: AuditAction.AUTH_LOGIN,
      resourceType: AuditResourceType.USER,
      resourceId: 'user-1',
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
      user: { id: 'user-1' } as any,
      organization: { id: 'org-1' } as any,
    };

    it('should create and save an audit log entry', async () => {
      const created = { id: 1, ...auditLogData };
      mockAuditLogRepository.create.mockReturnValue(created);
      mockAuditLogRepository.save.mockResolvedValue(created);

      await service.create(auditLogData);

      expect(mockAuditLogRepository.create).toHaveBeenCalledWith(auditLogData);
      expect(mockAuditLogRepository.save).toHaveBeenCalledWith(created);
    });

    it('should create audit log with minimal data', async () => {
      const minimal = {
        action: AuditAction.AUTH_LOGOUT,
        resourceType: AuditResourceType.USER,
        resourceId: 'user-1',
      };
      mockAuditLogRepository.create.mockReturnValue(minimal);
      mockAuditLogRepository.save.mockResolvedValue(minimal);

      await service.create(minimal);

      expect(mockAuditLogRepository.create).toHaveBeenCalledWith(minimal);
      expect(mockAuditLogRepository.save).toHaveBeenCalled();
    });

    it('should propagate error if save fails', async () => {
      mockAuditLogRepository.create.mockReturnValue({});
      mockAuditLogRepository.save.mockRejectedValue(new Error('DB error'));

      await expect(service.create(auditLogData)).rejects.toThrow('DB error');
    });
  });
});
