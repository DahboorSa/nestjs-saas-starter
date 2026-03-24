import {
  IsArray,
  IsEnum,
  IsUrl,
  ArrayMinSize,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';
import { WebhookEvent } from '../../../enums';

export class CreateWebhookDto {
  @MaxLength(2048)
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  url: string;

  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsArray()
  @IsEnum(WebhookEvent, { each: true })
  events: WebhookEvent[];
}
