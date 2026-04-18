import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { InvitationService } from './invitation.service';
import {
  AuditContext,
  CurrentUser,
  JwtOnly,
  Public,
  Roles,
} from '../../common/decorators';
import { AuditContextDto, UserInfoDto } from '../../common/dto';
import { CreateInvitationDto, AcceptInvitationDto } from './dto';
import { InvitationStatus, UserRole } from '../../enums';
import { MemberInviteTrackerInterceptor } from '../../modules/invitations/interceptors/member-invite-tracker.interceptor';

@Controller('invitations')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Get()
  getList(
    @CurrentUser() user: UserInfoDto,
    @Query('status') status: InvitationStatus = InvitationStatus.PENDING,
  ) {
    return this.invitationService.getList(user, status);
  }

  @Post()
  @JwtOnly()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @UseInterceptors(MemberInviteTrackerInterceptor)
  sendInvitations(
    @AuditContext() auditContext: AuditContextDto,
    @CurrentUser() user: UserInfoDto,
    @Body() body: CreateInvitationDto,
  ) {
    return this.invitationService.send(auditContext, user, body);
  }

  @Post('accept')
  @Public()
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(
    @AuditContext() auditContext: AuditContextDto,
    @Query('token') token: string,
    @Body() body: AcceptInvitationDto,
  ) {
    return this.invitationService.acceptInvitation(auditContext, token, body);
  }
}
