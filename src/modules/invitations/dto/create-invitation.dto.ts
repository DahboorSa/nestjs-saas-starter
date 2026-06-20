import { IsEmail, IsEnum } from 'class-validator';
import { UserRole } from '../../../enums';

export class InvitationItemDto {
  @IsEmail()
  email: string;

  @IsEnum(UserRole)
  role: UserRole;
}
