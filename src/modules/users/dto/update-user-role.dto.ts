import { IsEnum } from 'class-validator';
import { UserRole } from '../../../enums';

export class UpdateUserRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}
