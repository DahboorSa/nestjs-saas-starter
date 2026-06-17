import { IsArray, IsEmail, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '../../../enums';

export class InvitationItemDto {
  @IsEmail()
  email: string;

  @IsEnum(UserRole)
  role: UserRole;
}

export class CreateInvitationsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvitationItemDto)
  invitations: InvitationItemDto[];
}
