import { ArrayMinSize, IsArray, IsString, MaxLength } from 'class-validator';

export class CreateApiKeyDto {
  @MaxLength(100)
  @IsString()
  name: string;
  @ArrayMinSize(1)
  @IsArray()
  @IsString({ each: true })
  scopes: string[];
}
