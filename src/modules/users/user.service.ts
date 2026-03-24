import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserEntity } from './entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserInfoDto } from '../../common/dto';
import {
  AuditAction,
  AuditResourceType,
  UserRole,
  WebhookEvent,
} from '../../enums';
import { CacheService } from '../../cache/cache.service';
import { AuditContextDto } from '../../common/dto';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { WebhookDispatcherService } from '../webhook-dispatchers/webhook-dispatcher.service';
import { UpdateUserEmailDto } from './dto';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { EmailQueueService } from '../../jobs/queues/email.queue';
import { JwtUtilityService } from '../../common/utils/jwt-utility.service';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly jwtUtilityService: JwtUtilityService,
    private readonly emailQueue: EmailQueueService,
    private readonly auditLogService: AuditLogService,
    private readonly dispatcher: WebhookDispatcherService,
  ) {}

  private mapUserData(user: UserEntity): Partial<UserEntity> {
    return {
      id: user.id,
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      userName: user.userName,
      role: user.role,
      email: user.email,
      isVerified: user.isVerified,
      isActive: user.isActive,
      organization: user.organization,
    };
  }

  async findAll(organizationId: string): Promise<Partial<UserEntity>[]> {
    const users = await this.userRepository.find({
      where: { isActive: true, organization: { id: organizationId } },
    });
    return users.map((user) => this.mapUserData(user));
  }

  async create(user: Partial<UserEntity>): Promise<UserEntity | null> {
    const userInfo = this.userRepository.create({ ...user });
    return this.userRepository.save(userInfo);
  }

  async getByEmail(
    email: string,
    includeOrg?: boolean,
  ): Promise<UserEntity | null> {
    if (includeOrg)
      return this.userRepository.findOne({
        where: { email },
        relations: ['organization'],
      });
    return this.userRepository.findOneBy({ email });
  }

  async getById(
    id: string,
    organizationId: string,
    includeOrg?: boolean,
  ): Promise<UserEntity | null> {
    if (includeOrg)
      return this.userRepository.findOne({
        where: { id, organization: { id: organizationId } },
        relations: ['organization'],
      });
    return this.userRepository.findOneBy({
      id,
      organization: { id: organizationId },
    });
  }

  async getDetails(user: UserInfoDto): Promise<Partial<UserEntity>> {
    const { userId: id, orgId: organizationId } = user;
    const userInfo = await this.userRepository.findOne({
      where: { id, organization: { id: organizationId } },
      relations: ['organization'],
    });
    return userInfo && this.mapUserData(userInfo);
  }

  async getTotalActiveUsers(organizationId: string): Promise<number> {
    return await this.userRepository.count({
      where: {
        organization: { id: organizationId },
        isActive: true,
      },
    });
  }

  async preload(
    userId: string,
    body: Partial<UserEntity>,
  ): Promise<UserEntity> {
    const userInfo = await this.userRepository.preload({
      id: userId,
      ...body,
    });
    if (!userInfo) throw new NotFoundException('User not found');
    return this.userRepository.save(userInfo);
  }

  private auditAndDispatch(
    orgId: string,
    auditContext: AuditContextDto,
    action: AuditAction,
    webhookEvent: WebhookEvent,
    userInfo: UserEntity,
    payload: any,
  ) {
    const { id: userId } = userInfo;
    this.auditLogService
      .create({
        ...auditContext,
        action,
        resourceType: AuditResourceType.USER,
        resourceId: userId,
        user: userInfo,
      })
      .catch(() => {
        this.logger.error('Error creating audit');
      });
    this.dispatcher.dispatch(orgId, webhookEvent, payload).catch((error) => {
      this.logger.error('Error dispatching webhook', error);
    });
  }

  async remove(
    auditContext: AuditContextDto,
    currentUser: UserInfoDto,
    userId: string,
  ) {
    const { orgId } = currentUser;
    const userInfo = await this.getById(userId, orgId);
    if (!userInfo) throw new NotFoundException('User not found');
    if (!userInfo.isActive)
      throw new ForbiddenException('User already removed');
    if (currentUser.userId === userId)
      throw new BadRequestException('You cannot remove yourself');
    if (userInfo.role === UserRole.OWNER)
      throw new BadRequestException('owner cannot be removed');
    if (currentUser.role === UserRole.ADMIN && userInfo.role === UserRole.ADMIN)
      throw new BadRequestException('Admin cannot be removed by another admin');

    this.userRepository.merge(userInfo, {
      isActive: false,
    });
    const updatedUser = await this.userRepository.save(userInfo);
    await this.cacheService.delete(`auth:refresh:${userInfo.id}`);

    this.auditAndDispatch(
      orgId,
      auditContext,
      AuditAction.MEMBER_REMOVED,
      WebhookEvent.MEMBER_REMOVED,
      userInfo,
      {
        removedUserId: userId,
        removedEmail: updatedUser.email,
      },
    );
    return this.mapUserData(updatedUser);
  }

  async updateRole(
    auditContext: AuditContextDto,
    currentUser: UserInfoDto,
    body: Partial<UserEntity>,
  ): Promise<Partial<UserEntity>> {
    const { id: userId, role } = body;
    if (role === UserRole.OWNER)
      throw new BadRequestException('Cannot assign owner role');
    const { orgId } = currentUser;
    const userInfo = await this.getById(userId, orgId);
    if (!userInfo) throw new NotFoundException('User not found');
    if (!userInfo.isActive)
      throw new ForbiddenException('User account has been deactivated');
    if (currentUser.userId === userId)
      throw new BadRequestException('You cannot update role of yourself');
    if (role === userInfo.role)
      throw new BadRequestException('Role is already assigned');
    if (userInfo.role === UserRole.OWNER)
      throw new BadRequestException('Owner cannot be updated by another owner');

    const oldRole = userInfo.role;
    this.userRepository.merge(userInfo, {
      role: body.role,
    });
    const updatedUser = await this.userRepository.save(userInfo);

    this.auditAndDispatch(
      orgId,
      auditContext,
      AuditAction.MEMBER_ROLE_UPDATED,
      WebhookEvent.MEMBER_ROLE_UPDATED,
      userInfo,
      {
        updatedUserId: userId,
        updatedEmail: updatedUser.email,
        oldRole,
        updatedRole: updatedUser.role,
      },
    );
    return this.mapUserData(updatedUser);
  }

  async update(
    auditContext: AuditContextDto,
    userInfo: UserInfoDto,
    body: Partial<UserEntity>,
  ) {
    const { userId, orgId } = userInfo;
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');
    this.userRepository.merge(user, body);
    await this.userRepository.save(user);
    const updatedUser = this.mapUserData(user);

    this.auditAndDispatch(
      orgId,
      auditContext,
      AuditAction.MEMBER_UPDATED,
      WebhookEvent.MEMBER_UPDATED,
      user,
      {
        updatedUserId: userId,
        updatedInfo: body,
      },
    );
    return updatedUser;
  }

  async changeEmail(user: UserInfoDto, body: UpdateUserEmailDto) {
    const { userId, orgId, email: oldEmail } = user;
    const { email } = body;
    if (email === oldEmail) {
      throw new BadRequestException('Email cannot be same as old email');
    }

    const existingEmail = await this.userRepository.findOneBy({ email });
    if (existingEmail && existingEmail.id !== userId) {
      throw new BadRequestException('Email already exists');
    }

    const token = randomBytes(32).toString('hex');

    await this.cacheService.set(
      `change:email:${token}`,
      JSON.stringify({
        userId,
        email,
        oldEmail,
        orgId,
      }),
      this.configService.get<number>('TTL_EXPIRATION'),
    );
    await this.emailQueue.add('change-email.email', {
      token,
      userId,
      email,
    });

    return {
      message:
        'Email change request has been sent to your email, please check your inbox',
    };
  }

  async confirmEmailChange(auditContext: AuditContextDto, token: string) {
    const tokenKey = `change:email:${token}`;
    const tokenInfo = await this.cacheService.get(tokenKey);
    if (!tokenInfo)
      throw new UnauthorizedException(
        'Email change token is invalid or expired',
      );
    const data = JSON.parse(tokenInfo);
    const { userId, orgId, email, oldEmail } = data;

    const userInfo = await this.getById(userId, orgId, true);
    if (!userInfo) throw new UnauthorizedException('User not found');
    if (!userInfo.isActive)
      throw new UnauthorizedException('User account has been deactivated');

    this.userRepository.merge(userInfo, { email });
    await this.userRepository.save(userInfo);

    await this.cacheService.delete(tokenKey);

    const payload = {
      userId,
      orgId,
      role: userInfo.role,
      email,
    };
    const { accessToken, refreshToken } =
      this.jwtUtilityService.generateToken(payload);

    await this.cacheService.set(
      `auth:refresh:${userId}`,
      refreshToken,
      this.configService.get<number>('jwt.jwtRefreshRedisExpiry'),
    );

    this.auditAndDispatch(
      orgId,
      auditContext,
      AuditAction.MEMBER_EMAIL_UPDATED,
      WebhookEvent.MEMBER_EMAIL_UPDATED,
      userInfo,
      {
        newEmail: email,
        oldEmail,
      },
    );

    return {
      message: 'Email change request has been confirmed',
      accessToken,
      refreshToken,
    };
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.userRepository.save({ id: userId, lastLoginAt: new Date() });
  }

  async updatePassword(userInfo: UserEntity, body: Partial<UserEntity>) {
    this.userRepository.merge(userInfo, body);
    await this.userRepository.save(userInfo);
  }
}
