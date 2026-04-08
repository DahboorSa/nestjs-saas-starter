import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuditContext, JwtOnly, Roles } from '../../common/decorators';
import { AuditContextDto } from '../../common/dto/audit-context.dto';
import { PaymentService } from './payment.service';
import { CreateSubscriptionDto } from './dto';
import { UserRole } from '../../enums';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}
  @Post('subscription')
  @Roles(UserRole.OWNER)
  @JwtOnly()
  @HttpCode(HttpStatus.CREATED)
  async createSubscription(
    @AuditContext() auditContext: AuditContextDto,
    @Body() body: CreateSubscriptionDto,
  ) {
    return await this.paymentService.createSubscription(auditContext, body);
  }

  @Get('subscription')
  @Roles(UserRole.OWNER)
  @JwtOnly()
  async getSubscription(@AuditContext() auditContext: AuditContextDto) {
    return this.paymentService.getSubscription(auditContext);
  }
}
