import { IsNotEmpty, IsString } from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  paymentMethodId: string;
}
