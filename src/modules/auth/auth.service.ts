import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ResetPasswordDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResendVerifyEmailDto,
} from './dto';
import { AuditContextDto, UserInfoDto } from '../../common/dto';
import { OrganizationService } from '../organizations/organization.service';
import { UserService } from '../users/user.service';
import { PlanService } from '../plans/plan.service';
import { DataSource } from 'typeorm';
import * as argon from 'argon2';
import {
  AuditAction,
  AuditResourceType,
  PaymentStatus,
  UserRole,
} from '../../enums';
import { OrganizationEntity } from '../organizations/entities/organization.entity';
import { UserEntity } from '../users/entities/user.entity';
import { CacheService } from '../../cache/cache.service';
import { randomBytes } from 'crypto';
import { EmailQueueService } from '../../jobs/queues/email.queue';
import { ConfigService } from '@nestjs/config';
import { UtilityService } from '../../common/utils/utility.service';
import { JwtUtilityService } from '../../common/utils/jwt-utility.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly userService: UserService,
    private readonly planService: PlanService,
    private readonly dataSource: DataSource,
    private readonly cacheService: CacheService,
    private readonly emailQueue: EmailQueueService,
    private readonly configService: ConfigService,
    private readonly utilityService: UtilityService,
    private readonly jwtUtilityService: JwtUtilityService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private audit(
    auditContext: AuditContextDto,
    action: AuditAction,
    user: UserEntity,
    organization: OrganizationEntity,
  ) {
    const { id: userId } = user;
    this.auditLogService
      .create({
        ...auditContext,
        action,
        resourceType: AuditResourceType.USER,
        resourceId: userId,
        user,
        organization,
      })
      .catch(() => {
        this.logger.error('Error creating audit');
      });
  }

  async register(auditContext: AuditContextDto, body: RegisterDto) {
    let slug = this.utilityService.generateSlug(body.name);

    const organization = await this.organizationService.getBySlug(slug);
    if (organization) {
      this.logger.log('Organization already exists, creating new slug');
      slug = this.utilityService.generateSlug(body.name, true);
    }

    const user = await this.userService.getByEmail(body.email);
    if (user && user.isActive) {
      throw new ConflictException('User already exists');
    }

    const plan = await this.planService.getByName(body.plan);
    if (!plan) {
      throw new InternalServerErrorException('Plans not found');
    }

    const passwordHash = await argon.hash(body.password);

    return await this.dataSource
      .transaction(async (manager) => {
        const organization = await manager
          .getRepository(OrganizationEntity)
          .save({
            name: body.name,
            slug,
            plan,
            trialEndsAt: this.utilityService.getTrialEndDate(plan.trialDays),
            paymentStatus:
              plan.name === 'Free' ? PaymentStatus.FREE : PaymentStatus.TRIAL,
          });
        const user = await manager.getRepository(UserEntity).save({
          email: body.email?.toLowerCase(),
          userName: body.email?.split('@')[0],
          firstName: body.firstName,
          lastName: body.lastName,
          passwordHash,
          role: UserRole.OWNER,
          organization,
        });
        this.logger.log('User registered successfully', {
          organizationId: organization.id,
          userId: user.id,
        });
        const token = randomBytes(32).toString('hex');
        await this.cacheService.set(
          `verify:email:${token}`,
          JSON.stringify({ userId: user.id, orgId: organization.id }),
          this.configService.get<number>('TTL_EXPIRATION'),
        );
        await this.emailQueue.add('welcome.email', {
          token,
          email: body.email,
          userId: user.id,
        });
        this.audit(auditContext, AuditAction.USER_REGISTER, user, organization);
        return {
          message: 'Registration successful. Please verify your email.',
          organizationId: organization.id,
          userId: user.id,
        };
      })
      .catch((error) => {
        if (error?.status < 500) throw error;
        this.logger.error(error, {
          organizationName: body.name,
        });
        throw new InternalServerErrorException('Failed to register user');
      });
  }

  async verifyEmail(auditContext: AuditContextDto, token: string) {
    const key = `verify:email:${token}`;
    const tokenInfo = await this.cacheService.get(key);
    if (!tokenInfo) throw new UnauthorizedException('Invalid or expired token');
    const { userId, orgId } = JSON.parse(tokenInfo);
    const user = await this.userService.preload(userId, {
      isVerified: true,
    });
    await this.cacheService.delete(key);
    this.audit(auditContext, AuditAction.AUTH_VERIFY_EMAIL, user, {
      id: orgId,
    } as OrganizationEntity);
    return {
      message: 'Email verified successfully',
      userId,
      isVerified: true,
    };
  }

  async login(auditContext: AuditContextDto, loginDto: LoginDto) {
    const user = await this.userService.getByEmail(loginDto.email, true);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const isPasswordValid = await argon.verify(
      user.passwordHash,
      loginDto.password,
    );
    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid credentials');
    if (!user?.isVerified)
      throw new ForbiddenException('Please verify your email first');
    if (!user?.isActive)
      throw new ForbiddenException('Your account has been deactivated');
    const payload = {
      userId: user.id,
      orgId: user.organization.id,
      role: user.role,
      email: user.email,
    };
    const { accessToken, refreshToken } =
      await this.jwtUtilityService.issueTokenPair(payload);

    await this.userService.updateLastLogin(user.id);

    this.audit(auditContext, AuditAction.AUTH_LOGIN, user, user.organization);
    return {
      accessToken,
      refreshToken,
    };
  }

  async refresh(auditContext: AuditContextDto, body: RefreshTokenDto) {
    const { refreshToken: _refreshToken } = body;
    const valid = this.jwtUtilityService.verifyRefreshToken(_refreshToken);
    const { userId, orgId, email, role } = valid;
    const existingUser = await this.userService.getById(userId, orgId, true);
    if (!existingUser) throw new UnauthorizedException('User not found');
    if (!existingUser.isActive)
      throw new UnauthorizedException('User account has been deactivated');
    const existingRefreshToken = await this.cacheService.get(
      `auth:refresh:${userId}`,
    );
    if (!existingRefreshToken)
      throw new UnauthorizedException('User logged out');
    if (_refreshToken !== existingRefreshToken)
      throw new UnauthorizedException('Token was already rotated');

    await this.cacheService.delete(`auth:refresh:${userId}`);

    const payload = {
      userId,
      orgId,
      role,
      email,
    };
    const { accessToken, refreshToken } =
      await this.jwtUtilityService.issueTokenPair(payload);

    this.audit(
      auditContext,
      AuditAction.AUTH_REFRESH,
      existingUser,
      existingUser.organization,
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  async changePassword(
    auditContext: AuditContextDto,
    user: UserInfoDto,
    body: ChangePasswordDto,
  ) {
    const { email } = user;
    const userInfo = await this.userService.getByEmail(email, true);
    if (!userInfo) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await argon.verify(
      userInfo.passwordHash,
      body.oldPassword,
    );
    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid credentials');

    const sameOldPassword = await argon.verify(
      userInfo.passwordHash,
      body.password,
    );
    if (sameOldPassword)
      throw new BadRequestException(
        'New password cannot be same as old password',
      );
    if (body.password !== body.confirmPassword)
      throw new BadRequestException('Passwords do not match');

    const passwordHash = await argon.hash(body.password);

    await this.userService.updatePassword(userInfo, {
      passwordHash,
    });

    const payload = {
      userId: userInfo.id,
      orgId: userInfo.organization.id,
      role: user.role,
      email: user.email,
    };
    const { accessToken, refreshToken } =
      await this.jwtUtilityService.issueTokenPair(payload);

    await this.userService.updateLastLogin(userInfo.id);

    this.audit(
      auditContext,
      AuditAction.AUTH_CHANGE_PASSWORD,
      userInfo,
      userInfo.organization,
    );
    return {
      accessToken,
      refreshToken,
    };
  }

  async forgotPassword(auditContext: AuditContextDto, body: ForgotPasswordDto) {
    const user = await this.userService.getByEmail(body.email, true);
    if (user) {
      const token = randomBytes(32).toString('hex');
      await this.cacheService.set(
        `reset:password:${token}`,
        JSON.stringify({
          userId: user.id,
          email: user.email,
          orgId: user.organization.id,
        }),
        this.configService.get<number>('TTL_EXPIRATION'),
      );
      await this.emailQueue.add('forgot-password.email', {
        token,
        userId: user.id,
        email: body.email,
      });
      this.audit(
        auditContext,
        AuditAction.AUTH_FORGOT_PASSWORD,
        user,
        user.organization,
      );
    }
    return {
      message:
        'if your email is registered, you will receive an email to reset your password',
    };
  }
  async resetPassword(auditContext: AuditContextDto, body: ResetPasswordDto) {
    const { token, password, confirmPassword } = body;
    const tokenInfo = await this.cacheService.get(`reset:password:${token}`);
    if (!tokenInfo)
      throw new UnauthorizedException(
        'Password reset token is invalid or expired',
      );
    const data = JSON.parse(tokenInfo);
    const { userId, orgId, email } = data;

    const existingUser = await this.userService.getByEmail(email, true);
    if (!existingUser) throw new UnauthorizedException('User not found');
    if (!existingUser.isActive)
      throw new UnauthorizedException('User account has been deactivated');
    const sameOldPassword = await argon.verify(
      existingUser.passwordHash,
      password,
    );
    if (sameOldPassword)
      throw new BadRequestException(
        'New password cannot be same as old password',
      );
    if (password !== confirmPassword)
      throw new BadRequestException('Passwords do not match');

    const passwordHash = await argon.hash(password);

    await this.userService.updatePassword(existingUser, {
      passwordHash,
    });

    const payload = {
      userId,
      orgId,
      role: existingUser.role,
      email,
    };
    const { accessToken, refreshToken } =
      await this.jwtUtilityService.issueTokenPair(payload);

    this.audit(
      auditContext,
      AuditAction.AUTH_RESET_PASSWORD,
      existingUser,
      existingUser.organization,
    );
    await this.cacheService.delete(`reset:password:${token}`);
    return {
      accessToken,
      refreshToken,
    };
  }

  async resendVerifyEmail(
    auditContext: AuditContextDto,
    body: ResendVerifyEmailDto,
  ) {
    const { email } = body;
    const user = await this.userService.getByEmail(email, true);
    if (user && user.isActive && !user.isVerified) {
      const { organization, id: userId } = user;
      const { id: orgId } = organization;

      const token = randomBytes(32).toString('hex');
      await this.cacheService.set(
        `verify:email:${token}`,
        JSON.stringify({ userId, orgId }),
        this.configService.get<number>('TTL_EXPIRATION'),
      );
      await this.emailQueue.add('resend-verify.email', {
        token,
        email,
        userId: user.id,
      });

      this.audit(
        auditContext,
        AuditAction.AUTH_RESEND_VERIFY_EMAIL,
        user,
        organization,
      );
    }
    return {
      message:
        'If your email is registered and unverified, a new link has been sent',
    };
  }

  async logout(auditContext: AuditContextDto, user: UserInfoDto) {
    const { userId, token, orgId } = user;
    await this.cacheService.delete(`auth:refresh:${userId}`);
    const ttl = user.expiresIn - Math.floor(Date.now() / 1000);
    if (ttl > 0)
      await this.cacheService.set(`auth:blacklist:${token}`, '1', ttl);

    this.audit(
      auditContext,
      AuditAction.AUTH_LOGOUT,
      { id: userId } as UserEntity,
      { id: orgId } as OrganizationEntity,
    );
    return { message: 'Logged out successfully' };
  }
}
