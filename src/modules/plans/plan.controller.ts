import { Controller, Get } from '@nestjs/common';
import { PlanService } from './plan.service';
import { Public } from '../../common/decorators';

@Controller('plans')
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @Get()
  @Public()
  async getList() {
    return this.planService.getAll();
  }
}
