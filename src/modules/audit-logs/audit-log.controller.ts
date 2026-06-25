import { Controller, Get, Query } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { CurrentUser } from '../../common/decorators';
import { UserInfoDto } from '../../common/dto';

@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  getAuditLogs(
    @CurrentUser() user: UserInfoDto,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.auditLogService.findByOrganization(user.orgId, from, to);
  }
}
