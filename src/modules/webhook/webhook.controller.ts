import {
  Body,
  Controller,
  Get,
  Post,
  Delete,
  UseInterceptors,
  Param,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { AuditContext, JwtOnly, Roles } from '../../common/decorators';
import { AuditContextDto } from '../../common/dto';
import { UserRole } from '../../enums';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { WebhookTrackerInterceptor } from './interceptors/webhook-tracker.interceptor';

@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @JwtOnly()
  findAll(@AuditContext() auditContext: AuditContextDto) {
    return this.webhookService.findAll(auditContext.organizationId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @JwtOnly()
  @UseInterceptors(WebhookTrackerInterceptor)
  create(
    @AuditContext() auditContext: AuditContextDto,
    @Body() body: CreateWebhookDto,
  ) {
    return this.webhookService.create(auditContext, body);
  }

  @Delete('/:id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @JwtOnly()
  delete(
    @AuditContext() auditContext: AuditContextDto,
    @Param('id') id: string,
  ) {
    return this.webhookService.remove(auditContext, id);
  }

  @Get('/:id/deliveries')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @JwtOnly()
  findAllDeliveries(
    @AuditContext() auditContext: AuditContextDto,
    @Param('id') id: string,
  ) {
    return this.webhookService.findAllDeliveries(auditContext, id);
  }
}
