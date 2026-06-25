import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from './audit-log.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogEntity } from './entities/audit-log.entity';
import { AuditAction, AuditResourceType } from '../../enums';

const mockAuditLogRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
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

  // ─── findByOrganization ───────────────────────────────────────────────────────

  describe('findByOrganization', () => {
    beforeEach(() => {
      mockAuditLogRepository.find.mockResolvedValue([]);
    });

    it('defaults from to last 24h and uses MoreThanOrEqual when no dates given', async () => {
      const before = Date.now();
      await service.findByOrganization('org-1');
      const after = Date.now();

      const [call] = mockAuditLogRepository.find.mock.calls;
      const { createdAt } = call[0].where;

      expect(createdAt.type).toBe('moreThanOrEqual');
      const fromMs = (createdAt.value as Date).getTime();
      expect(fromMs).toBeGreaterThanOrEqual(before - 24 * 60 * 60 * 1000 - 50);
      expect(fromMs).toBeLessThanOrEqual(after - 24 * 60 * 60 * 1000 + 50);
    });

    it('uses MoreThanOrEqual with the provided date when only from is given', async () => {
      const from = '2024-01-15T00:00:00.000Z';
      await service.findByOrganization('org-1', from);

      const [call] = mockAuditLogRepository.find.mock.calls;
      const { createdAt } = call[0].where;

      expect(createdAt.type).toBe('moreThanOrEqual');
      expect(createdAt.value).toEqual(new Date(from));
    });

    it('uses Between when both from and to are given', async () => {
      const from = '2024-01-01T00:00:00.000Z';
      const to = '2024-01-31T23:59:59.000Z';
      await service.findByOrganization('org-1', from, to);

      const [call] = mockAuditLogRepository.find.mock.calls;
      const { createdAt } = call[0].where;

      expect(createdAt.type).toBe('between');
      expect(createdAt.value).toEqual([new Date(from), new Date(to)]);
    });

    it('filters by orgId', async () => {
      await service.findByOrganization('org-42');

      const [call] = mockAuditLogRepository.find.mock.calls;
      expect(call[0].where.organization).toEqual({ id: 'org-42' });
    });

    it('excludes AUTH_* actions via Not(In(...))', async () => {
      await service.findByOrganization('org-1');

      const [call] = mockAuditLogRepository.find.mock.calls;
      const { action } = call[0].where;

      // Not(In([...])).type === 'not'; .value resolves through the nested
      // FindOperator and returns the underlying array of excluded values.
      expect(action.type).toBe('not');
      const excluded: string[] = action.value as string[];
      expect(excluded).toContain(AuditAction.AUTH_LOGIN);
      expect(excluded).toContain(AuditAction.AUTH_LOGOUT);
      expect(excluded).toContain(AuditAction.AUTH_VERIFY_EMAIL);
      expect(excluded).not.toContain(AuditAction.USER_REGISTER);
      expect(excluded).not.toContain(AuditAction.ORG_UPDATED);
      expect(excluded).not.toContain(AuditAction.API_KEY_CREATED);
    });

    it('orders results by createdAt DESC', async () => {
      await service.findByOrganization('org-1');

      const [call] = mockAuditLogRepository.find.mock.calls;
      expect(call[0].order).toEqual({ createdAt: 'DESC' });
    });

    it('selects only the allowed fields', async () => {
      await service.findByOrganization('org-1');

      const [call] = mockAuditLogRepository.find.mock.calls;
      expect(call[0].select).toEqual([
        'action',
        'resourceType',
        'resourceId',
        'metadata',
        'createdAt',
      ]);
    });

    it('returns the audit logs from the repository', async () => {
      const logs = [
        {
          action: AuditAction.ORG_UPDATED,
          resourceType: AuditResourceType.ORGANIZATION,
          resourceId: 'org-1',
          metadata: {},
          createdAt: new Date(),
        },
      ];
      mockAuditLogRepository.find.mockResolvedValue(logs);

      const result = await service.findByOrganization('org-1');
      expect(result).toEqual(logs);
    });

    it('returns an empty array when no logs match', async () => {
      mockAuditLogRepository.find.mockResolvedValue([]);

      const result = await service.findByOrganization('org-1');
      expect(result).toEqual([]);
    });
  });
});
