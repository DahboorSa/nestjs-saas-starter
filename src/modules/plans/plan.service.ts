import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanEntity } from './entities/plan.entity';

@Injectable()
export class PlanService {
  constructor(
    @InjectRepository(PlanEntity)
    private readonly planRepository: Repository<PlanEntity>,
  ) {}

  async getDefault(): Promise<PlanEntity> {
    return this.planRepository.findOne({ where: { isDefault: true } });
  }

  async getAll(): Promise<PlanEntity[]> {
    return this.planRepository.find();
  }

  async getByName(name: string): Promise<PlanEntity | null> {
    return this.planRepository.findOne({ where: { name } });
  }
}
