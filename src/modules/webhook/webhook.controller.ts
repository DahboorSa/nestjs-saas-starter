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
import {
  AuditContext,
  CurrentUser,
  JwtOnly,
  Roles,
} from '../../common/decorators';
import { AuditContextDto, UserInfoDto } from '../../common/dto';
import { UserRole } from '../../enums';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { WebhookTrackerInterceptor } from './interceptors/webhook-tracker.interceptor';

@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Get()
  findAll(@CurrentUser() user: UserInfoDto) {
    return this.webhookService.findAll(user.orgId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @JwtOnly()
  @UseInterceptors(WebhookTrackerInterceptor)
  create(
    @AuditContext() auditContext: AuditContextDto,
    @CurrentUser() user: UserInfoDto,
    @Body() body: CreateWebhookDto,
  ) {
    return this.webhookService.create(auditContext, user, body);
  }

  @Delete('/:id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @JwtOnly()
  delete(
    @AuditContext() auditContext: AuditContextDto,
    @CurrentUser() user: UserInfoDto,
    @Param('id') id: string,
  ) {
    return this.webhookService.remove(auditContext, user, id);
  }
}
