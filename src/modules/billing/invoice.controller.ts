import { Controller, Get } from '@nestjs/common';
import { AuditContext, JwtOnly, Roles } from '../../common/decorators';
import { AuditContextDto } from '../../common/dto/audit-context.dto';
import { BillingService } from './billing.service';
import { UserRole } from '../../enums';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Billing')
@ApiBearerAuth('access-token')
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  @Roles(UserRole.OWNER)
  @JwtOnly()
  async getInvoices(@AuditContext() auditContext: AuditContextDto) {
    return this.billingService.getInvoices(auditContext);
  }
}
