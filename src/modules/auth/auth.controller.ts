import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  ResetPasswordDto,
  ForgotPasswordDto,
  ChangePasswordDto,
  ResendVerifyEmailDto,
} from './dto';
import { AuditContextDto, UserInfoDto } from '../../common/dto';
import {
  AuditContext,
  CurrentUser,
  JwtOnly,
  Public,
} from '../../common/decorators';
import { Throttle } from '@nestjs/throttler';

@Throttle({ auth: {} })
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setRefreshCookie(res: Response, token: string): void {
    const maxAge = +(process.env.REFRESH_TOKEN_TTL ?? 604800) * 1000;
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }

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
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.login(
      auditContext,
      loginDto,
    );
    this.setRefreshCookie(res, refreshToken);
    return { accessToken };
  }

  @Post('refresh-token')
  @Public()
  @HttpCode(HttpStatus.OK)
  async refresh(
    @AuditContext() auditContext: AuditContextDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.refreshToken;
    if (!token) throw new UnauthorizedException('Refresh token not found');
    const { accessToken, refreshToken } = await this.authService.refresh(
      auditContext,
      token,
    );
    this.setRefreshCookie(res, refreshToken);
    return { accessToken };
  }

  @Post('change-password')
  @JwtOnly()
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @AuditContext() auditContext: AuditContextDto,
    @CurrentUser() user: UserInfoDto,
    @Body() body: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.changePassword(
      auditContext,
      user,
      body,
    );
    this.setRefreshCookie(res, refreshToken);
    return { accessToken };
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
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.resetPassword(
      auditContext,
      body,
    );
    this.setRefreshCookie(res, refreshToken);
    return { accessToken };
  }

  @Post('logout')
  @JwtOnly()
  @HttpCode(HttpStatus.OK)
  async logout(
    @AuditContext() auditContext: AuditContextDto,
    @CurrentUser() user: UserInfoDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.clearRefreshCookie(res);
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
