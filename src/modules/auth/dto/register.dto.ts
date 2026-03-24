import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsStrongPassword,
  Length,
} from 'class-validator';
import { Plan } from '../../../enums';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(2, 100)
  name: string;

  @IsString()
  @Length(8, 64)
  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
    },
    {
      message:
        'Password is too weak. It must have at least 8 characters, one uppercase letter, one lowercase letter, one number.',
    },
  )
  password: string;

  @IsString()
  @IsOptional()
  firstName: string;

  @IsString()
  @IsOptional()
  lastName: string;

  @IsString()
  @IsEnum(Plan)
  @IsOptional()
  plan?: string = Plan.FREE;
}
