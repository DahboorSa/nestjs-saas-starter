import {
  Controller,
  Post,
  Headers,
  RawBodyRequest,
  Req,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { StripeWebhookService } from './stripe-webhook.service';
import { Public } from '../../common/decorators';

@Controller('stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(private readonly stripeWebhookService: StripeWebhookService) {}

  @Public()
  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }
    if (!req.rawBody) {
      throw new BadRequestException('Missing raw body');
    }
    try {
      await this.stripeWebhookService.handleWebhook(req.rawBody, signature);
    } catch (error) {
      if (error?.type === 'StripeSignatureVerificationError') {
        throw new BadRequestException('Invalid Stripe signature');
      }
      this.logger.error('Stripe webhook processing failed', error);
      throw error;
    }
    return { received: true };
  }
}
