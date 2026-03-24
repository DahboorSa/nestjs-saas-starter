import { UserRole } from '../../enums';

export class UserInfoDto {
  userId: string;
  email: string;
  orgId: string;
  role: UserRole;
  expiresIn?: number;
  token?: string;
}
