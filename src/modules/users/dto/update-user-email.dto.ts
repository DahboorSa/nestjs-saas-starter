import { IsEmail } from 'class-validator';

export class UpdateUserEmailDto {
  @IsEmail()
  email: string;
}
