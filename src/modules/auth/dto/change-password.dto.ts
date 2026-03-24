import { IsString, IsStrongPassword, Length } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @Length(8, 64)
  oldPassword: string;
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
  confirmPassword: string;
}
