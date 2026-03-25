import { Test, TestingModule } from '@nestjs/testing';
import { PlanService } from './plan.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PlanEntity } from './entities/plan.entity';

const mockPlanRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
};

const mockPlan: Partial<PlanEntity> = {
  id: 1,
  name: 'Free',
  isDefault: true,
  isActive: true,
  price: 0,
  limits: { maxApiKeys: 2, maxMembers: 5, maxWebhooks: 0 } as any,
};

describe('PlanService', () => {
  let service: PlanService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanService,
        {
          provide: getRepositoryToken(PlanEntity),
          useValue: mockPlanRepository,
        },
      ],
    }).compile();

    service = module.get<PlanService>(PlanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── getDefault ───────────────────────────────────────────────────────────────

  describe('getDefault', () => {
    it('should return the default plan', async () => {
      mockPlanRepository.findOne.mockResolvedValue(mockPlan);

      const result = await service.getDefault();

      expect(result).toEqual(mockPlan);
      expect(mockPlanRepository.findOne).toHaveBeenCalledWith({
        where: { isDefault: true },
      });
    });

    it('should return null if no default plan is set', async () => {
      mockPlanRepository.findOne.mockResolvedValue(null);

      const result = await service.getDefault();

      expect(result).toBeNull();
    });
  });

  // ─── getAll ───────────────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('should return all plans', async () => {
      const plans = [
        mockPlan,
        { ...mockPlan, id: 2, name: 'Pro', isDefault: false },
      ];
      mockPlanRepository.find.mockResolvedValue(plans);

      const result = await service.getAll();

      expect(result).toHaveLength(2);
      expect(mockPlanRepository.find).toHaveBeenCalled();
    });

    it('should return empty array if no plans exist', async () => {
      mockPlanRepository.find.mockResolvedValue([]);

      const result = await service.getAll();

      expect(result).toEqual([]);
    });
  });

  // ─── getByName ────────────────────────────────────────────────────────────────

  describe('getByName', () => {
    it('should return plan by name', async () => {
      mockPlanRepository.findOne.mockResolvedValue(mockPlan);

      const result = await service.getByName('Free');

      expect(result).toEqual(mockPlan);
      expect(mockPlanRepository.findOne).toHaveBeenCalledWith({
        where: { name: 'Free' },
      });
    });

    it('should return null if plan not found', async () => {
      mockPlanRepository.findOne.mockResolvedValue(null);

      const result = await service.getByName('Unknown');

      expect(result).toBeNull();
    });
  });
});
