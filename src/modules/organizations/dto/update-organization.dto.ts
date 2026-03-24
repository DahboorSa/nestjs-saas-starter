import { IsString, Length } from 'class-validator';

export class UpdateOrganizationDto {
  @Length(2, 100)
  @IsString()
  name: string;
}
