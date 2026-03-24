import { IsString, Length } from 'class-validator';

export class CreateOrganizationDto {
  @Length(2, 100)
  @IsString()
  name: string;
  @IsString()
  slug: string;
}
