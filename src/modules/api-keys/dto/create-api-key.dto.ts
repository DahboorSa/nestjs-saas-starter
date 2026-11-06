import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsOptional,
  IsString,
  MaxLength,
  MinDate,
} from 'class-validator';

export class CreateApiKeyDto {
  @MaxLength(100)
  @IsString()
  name: string;
  @ArrayMinSize(1)
  @IsArray()
  @IsString({ each: true })
  scopes: string[];
  /** When the key stops working (ISO 8601, in the future). Omit for a key that never expires. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  @MinDate(() => new Date())
  expiresAt?: Date;
}
