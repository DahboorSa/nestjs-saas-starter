import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ResetPasswordDto,
  ForgotPasswordDto,
  ChangePasswordDto,
  ResendVerifyEmailDto,
} from './dto';
import { AuditContextDto, UserInfoDto } from '../../common/dto';
import { AuditContext, CurrentUser, JwtOnly, Public } from '../auth/decorator';
import { Throttle } from '@nestjs/throttler';

@Throttle({ auth: {} })
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async register(
    @AuditContext() auditContext: AuditContextDto,
    @Body() registerDto: RegisterDto,
  ) {
    return this.authService.register(auditContext, registerDto);
  }

  @Post('verify-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @AuditContext() auditContext: AuditContextDto,
    @Query('token') token: string,
  ) {
    return this.authService.verifyEmail(auditContext, token);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(
    @AuditContext() auditContext: AuditContextDto,
    @Body() loginDto: LoginDto,
  ) {
    return this.authService.login(auditContext, loginDto);
  }

  @Post('refresh-token')
  @Public()
  @HttpCode(HttpStatus.OK)
  async refresh(
    @AuditContext() auditContext: AuditContextDto,
    @Body() body: RefreshTokenDto,
  ) {
    return this.authService.refresh(auditContext, body);
  }

  @Post('change-password')
  @JwtOnly()
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @AuditContext() auditContext: AuditContextDto,
    @CurrentUser() user: UserInfoDto,
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.changePassword(auditContext, user, body);
  }
  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @AuditContext() auditContext: AuditContextDto,
    @Body() body: ForgotPasswordDto,
  ) {
    return this.authService.forgotPassword(auditContext, body);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @AuditContext() auditContext: AuditContextDto,
    @Body() body: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(auditContext, body);
  }
  @Post('logout')
  @JwtOnly()
  @HttpCode(HttpStatus.OK)
  async logout(
    @AuditContext() auditContext: AuditContextDto,
    @CurrentUser() user: UserInfoDto,
  ) {
    return this.authService.logout(auditContext, user);
  }

  @Post('resend-verification')
  @Public()
  @HttpCode(HttpStatus.OK)
  async resendVerifyEmail(
    @AuditContext() auditContext: AuditContextDto,
    @Body() body: ResendVerifyEmailDto,
  ) {
    return this.authService.resendVerifyEmail(auditContext, body);
  }
}
