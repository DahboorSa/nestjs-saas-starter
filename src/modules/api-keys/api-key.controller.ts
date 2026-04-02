import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { UserRole } from '../../enums';
import {
  AuditContext,
  CurrentUser,
  JwtOnly,
  Roles,
} from '../../common/decorators';
import { CreateApiKeyDto } from './dto';
import { AuditContextDto, UserInfoDto } from '../../common/dto';

@Controller('api-keys')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  findAll(@CurrentUser() user: UserInfoDto) {
    return this.apiKeyService.getByOrgId(user.orgId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @JwtOnly()
  create(
    @AuditContext() auditContext: AuditContextDto,
    @CurrentUser() user: UserInfoDto,
    @Body() body: CreateApiKeyDto,
  ) {
    return this.apiKeyService.create(auditContext, user, body);
  }

  @Delete('/:id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @JwtOnly()
  remove(
    @AuditContext() auditContext: AuditContextDto,
    @CurrentUser() user: UserInfoDto,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.apiKeyService.remove(auditContext, user, id);
  }
}
