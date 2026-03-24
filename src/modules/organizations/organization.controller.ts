import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { AuditContext, CurrentUser, JwtOnly, Roles } from '../auth/decorator';
import { UserInfoDto } from '../../common/dto';
import { UpdateOrganizationDto } from './dto';
import { UserRole } from '../../enums';
import { UserService } from '../users/user.service';
import { UpdateUserRoleDto } from '../users/dto';
import { AuditContextDto } from '../../common/dto';

@Controller('organizations')
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly userService: UserService,
  ) {}

  @Get('me')
  getOrganizations(@CurrentUser() user: UserInfoDto) {
    return this.organizationService.getDetails(user);
  }

  @Get('members')
  getMembers(@CurrentUser() user: UserInfoDto) {
    return this.userService.findAll(user.orgId);
  }

  @Put('me')
  @JwtOnly()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  updateOrganizations(
    @AuditContext() auditContext: AuditContextDto,
    @CurrentUser() user: UserInfoDto,
    @Body() body: UpdateOrganizationDto,
  ) {
    return this.organizationService.updateName(auditContext, user, body);
  }

  @Put('members/:userId/role')
  @JwtOnly()
  @Roles(UserRole.OWNER)
  updateMemberRole(
    @AuditContext() auditContext: AuditContextDto,
    @CurrentUser() user: UserInfoDto,
    @Param('userId') userId: string,
    @Body() body: UpdateUserRoleDto,
  ) {
    return this.userService.updateRole(auditContext, user, {
      id: userId,
      role: body.role,
    });
  }

  @Delete('members/:userId')
  @JwtOnly()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  removeMember(
    @AuditContext() auditContext: AuditContextDto,
    @CurrentUser() user: UserInfoDto,
    @Param('userId') userId: string,
  ) {
    return this.userService.remove(auditContext, user, userId);
  }
}
