import { Test, TestingModule } from '@nestjs/testing';
import { PlanController } from './plan.controller';
import { PlanService } from './plan.service';

const mockPlanService = {
  getAll: jest.fn(),
};

const mockPlan = {
  id: 1,
  name: 'Free',
  isDefault: true,
  isActive: true,
  price: 0,
};

describe('PlanController', () => {
  let controller: PlanController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlanController],
      providers: [{ provide: PlanService, useValue: mockPlanService }],
    }).compile();

    controller = module.get<PlanController>(PlanController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── GET /plans ───────────────────────────────────────────────────────────────

  describe('getList', () => {
    it('should return all plans', async () => {
      const plans = [
        mockPlan,
        { ...mockPlan, id: 2, name: 'Pro', isDefault: false, price: 29 },
      ];
      mockPlanService.getAll.mockResolvedValue(plans);

      const result = await controller.getList();

      expect(result).toHaveLength(2);
      expect(mockPlanService.getAll).toHaveBeenCalled();
    });

    it('should return empty array if no plans exist', async () => {
      mockPlanService.getAll.mockResolvedValue([]);

      const result = await controller.getList();

      expect(result).toEqual([]);
    });
  });
});
