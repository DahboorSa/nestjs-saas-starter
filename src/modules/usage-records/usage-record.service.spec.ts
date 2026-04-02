import { Test, TestingModule } from '@nestjs/testing';
import { UsageRecordService } from './usage-record.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsageRecordEntity } from './entities/usage-record.entity';
import { UsageMetric } from '../../enums';

const mockUsageRecordRepository = {
  upsert: jest.fn(),
};

const mockRecord: Partial<UsageRecordEntity> = {
  metric: UsageMetric.API_CALLS,
  period: '2026-03',
  value: 10,
  organization: { id: 'org-1' } as any,
};

describe('UsageRecordService', () => {
  let service: UsageRecordService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageRecordService,
        {
          provide: getRepositoryToken(UsageRecordEntity),
          useValue: mockUsageRecordRepository,
        },
      ],
    }).compile();

    service = module.get<UsageRecordService>(UsageRecordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── create ───────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should upsert a single usage record', async () => {
      mockUsageRecordRepository.upsert.mockResolvedValue(undefined);

      await service.create('org-1', mockRecord);

      expect(mockUsageRecordRepository.upsert).toHaveBeenCalledWith(
        {
          metric: UsageMetric.API_CALLS,
          period: '2026-03',
          value: 10,
          organization: { id: 'org-1' },
        },
        ['organizationId', 'metric', 'period'],
      );
    });

    it('should propagate error if upsert fails', async () => {
      mockUsageRecordRepository.upsert.mockRejectedValue(new Error('DB error'));

      await expect(service.create('org-1', mockRecord)).rejects.toThrow(
        'DB error',
      );
    });
  });
});
