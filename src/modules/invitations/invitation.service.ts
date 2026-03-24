import {
  ConflictException,
  Injectable,
  Logger,
  RequestTimeoutException,
  UnauthorizedException,
} from '@nestjs/common';
import { InvitationEntity } from './entities/invitation.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import {
  AuditAction,
  AuditResourceType,
  InvitationStatus,
  UserRole,
  WebhookEvent,
} from '../../enums';
import { AcceptInvitationDto, CreateInvitationDto } from './dto';
import { randomBytes } from 'crypto';
import { AuditContextDto, UserInfoDto } from '../../common/dto';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../cache/cache.service';
import { EmailQueueService } from '../../jobs/queues/email.queue';
import { UserService } from '../users/user.service';
import * as argon from 'argon2';
import { OrganizationService } from '../organizations/organization.service';
import { OrganizationEntity } from '../organizations/entities/organization.entity';
import { JwtUtilityService } from '../../common/utils/jwt-utility.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { WebhookDispatcherService } from '../webhook-dispatchers/webhook-dispatcher.service';

@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);
  constructor(
    @InjectRepository(InvitationEntity)
    private readonly invitationRepository: Repository<InvitationEntity>,
    private readonly userService: UserService,
    private readonly organizationService: OrganizationService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
    private readonly emailQueue: EmailQueueService,
    private readonly jwtUtilityService: JwtUtilityService,
    private readonly auditLogService: AuditLogService,
    private readonly dispatcher: WebhookDispatcherService,
  ) {}
  async getPendingInvitationByEmail(email: string): Promise<InvitationEntity> {
    return await this.invitationRepository.findOne({
      where: { email, status: InvitationStatus.PENDING },
    });
  }

  async getList(
    user: UserInfoDto,
    status: InvitationStatus,
  ): Promise<InvitationEntity[]> {
    const list = await this.invitationRepository.find({
      where: { status, organization: { id: user.orgId } },
    });

    return list;
  }

  async create(
    invitation: Partial<InvitationEntity>,
  ): Promise<InvitationEntity> {
    const invitationData = this.invitationRepository.create({ ...invitation });
    return this.invitationRepository.save(invitationData);
  }

  async send(
    auditContext: AuditContextDto,
    user: UserInfoDto,
    body: CreateInvitationDto,
  ) {
    const { orgId, userId } = user;
    const userExists = await this.userService.getByEmail(body.email, true);
    if (userExists?.isActive) {
      if (userExists.organization.id === user.orgId)
        throw new ConflictException('User already exists in this organization');
      else throw new ConflictException('User already exists');
    }
    const { email } = body;
    const pendingInvitation = await this.getPendingInvitationByEmail(email);
    if (pendingInvitation)
      throw new ConflictException('Invitation already sent');

    const token = randomBytes(32).toString('hex');

    const userInfo = await this.userService.getById(user.userId, orgId, true);
    const { organization } = userInfo;
    const expiresAt = new Date(
      Date.now() + this.configService.get<number>('INVITE_TOKEN_TTL') * 1000,
    );
    const invitation = await this.create({
      email,
      role: body.role,
      token,
      organization,
      invitedBy: userInfo,
      status: InvitationStatus.PENDING,
      expiresAt,
    });
    const { id: invitationId } = invitation;
    await this.cacheService.set(
      `invite:${token}`,
      JSON.stringify({
        invitationId,
        email,
        orgId,
        role: body.role,
        expiresAt,
      }),
      this.configService.get<number>('INVITE_TOKEN_TTL'),
    );

    await this.emailQueue.add('invite.email', {
      userId,
      orgName: organization.name,
      inviterEmail: user.email,
      inviterName: userInfo.firstName,
      email,
      token,
    });

    this.dispatcher
      .dispatch(orgId, WebhookEvent.MEMBER_INVITED, {
        invitedEmail: email,
        role: body.role,
        invitedBy: user.email,
      })
      .catch((error) => {
        this.logger.error('Error dispatching webhook', error);
      });

    this.auditLogService
      .create({
        ...auditContext,
        action: AuditAction.MEMBER_INVITED,
        resourceType: AuditResourceType.USER,
        resourceId: invitationId.toString(),
        organization,
      })
      .catch(() => {
        this.logger.error('Error creating audit log for member invited');
      });

    return {
      message: 'Invitation sent successfully',
    };
  }

  async acceptInvitation(
    auditContext: AuditContextDto,
    token: string,
    body: AcceptInvitationDto,
  ) {
    let inviteToken = await this.cacheService.get(`invite:${token}`);
    let tokenData: {
      invitationId: number;
      email: string;
      orgId: string;
      role: UserRole;
      status?: InvitationStatus;
      expiresAt: Date | string;
      organization?: OrganizationEntity;
    };

    if (!inviteToken) {
      inviteToken = await this.invitationRepository.findOne({
        where: {
          token,
        },
        relations: ['organization'],
      });
      if (!inviteToken)
        throw new UnauthorizedException('Invitation expired or invalid');

      tokenData = {
        invitationId: inviteToken.id,
        email: inviteToken.email,
        orgId: inviteToken.organization.id,
        role: inviteToken.role,
        status: inviteToken.status,
        expiresAt: inviteToken.expiresAt,
        organization: inviteToken.organization,
      };
    } else {
      try {
        tokenData = JSON.parse(inviteToken);
      } catch {
        throw new UnauthorizedException('Invitation expired or invalid');
      }
    }

    const {
      invitationId,
      expiresAt,
      email,
      orgId,
      role,
      status = InvitationStatus.PENDING,
      organization = { id: orgId } as OrganizationEntity,
    } = tokenData;

    if (status !== InvitationStatus.PENDING)
      throw new ConflictException('Invitation already accepted');

    const isExpired = Date.now() > new Date(expiresAt).getTime();
    if (isExpired) throw new RequestTimeoutException('Invitation expired');

    const userExists = await this.userService.getByEmail(email, true);
    if (userExists?.isActive)
      if (userExists.organization.id === orgId)
        throw new ConflictException('User already exists in this organization');
      else throw new ConflictException('User already exists');

    const passwordHash = await argon.hash(body.password);

    const user =
      userExists && !userExists?.isActive
        ? await this.userService.preload(userExists.id, {
            firstName: body.firstName || userExists.firstName,
            lastName: body.lastName || userExists.lastName,
            role,
            organization,
            passwordHash,
            isActive: true,
            isVerified: true,
          })
        : await this.userService.create({
            firstName: body.firstName,
            lastName: body.lastName,
            userName: email?.split('@')[0],
            email,
            isVerified: true,
            passwordHash,
            role,
            organization,
          });

    const payload = {
      userId: user.id,
      orgId: user.organization.id,
      role: user.role,
      email: user.email,
    };
    const { accessToken, refreshToken } =
      this.jwtUtilityService.generateToken(payload);

    const updatedInvitation = await this.invitationRepository.preload({
      id: invitationId,
      status: InvitationStatus.ACCEPTED,
    });

    await this.invitationRepository.save(updatedInvitation);

    await this.cacheService.set(
      `auth:refresh:${user.id}`,
      refreshToken,
      this.configService.get<number>('jwt.jwtRefreshRedisExpiry'),
    );
    await this.cacheService.delete(`invite:${token}`);

    this.auditLogService
      .create({
        ...auditContext,
        action: AuditAction.MEMBER_INVITE_ACCEPTED,
        resourceType: AuditResourceType.USER,
        resourceId: invitationId.toString(),
        user,
        organization,
        metadata: payload,
      })
      .catch(() => {
        this.logger.error(
          'Error creating audit log for member invite accepted',
        );
      });

    this.dispatcher
      .dispatch(orgId, WebhookEvent.MEMBER_INVITE_ACCEPTED, {
        email,
        userId: user.id,
      })
      .catch((error) => {
        this.logger.error('Error dispatching webhook', error);
      });
    return {
      accessToken,
      refreshToken,
    };
  }

  async expireInvitations() {
    await this.invitationRepository.update(
      { status: InvitationStatus.PENDING, expiresAt: LessThan(new Date()) },
      { status: InvitationStatus.EXPIRED },
    );
  }
}
