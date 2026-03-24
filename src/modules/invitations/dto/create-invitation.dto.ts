import { IsEmail, IsEnum } from 'class-validator';
import { UserRole } from '../../../enums';

export class CreateInvitationDto {
  @IsEmail()
  email: string;
  @IsEnum(UserRole)
  role: UserRole;
}
