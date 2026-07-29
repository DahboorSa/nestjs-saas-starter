import { IsEnum, IsString } from 'class-validator';
import { Plan } from '../../../enums';

export class UpdatePlanDto {
  @IsString()
  @IsEnum(Plan)
  plan: Plan;
}
