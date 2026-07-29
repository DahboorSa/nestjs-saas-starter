import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OrganizationEntity } from './entities/organization.entity';
import { Repository } from 'typeorm';
import { AuditContextDto, UserInfoDto } from '../../common/dto';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  UpdatePlanDto,
} from './dto';
import { UtilityService } from '../../common/utils/utility.service';
import { UserService } from '../users/user.service';
import { PlanEntity } from '../plans/entities/plan.entity';
import { PlanService } from '../plans/plan.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import {
  AuditAction,
  AuditResourceType,
  PaymentStatus,
  WebhookEvent,
} from '../../enums';
import { WebhookDispatcherService } from '../webhook-dispatchers/webhook-dispatcher.service';
import { StripeService } from '../stripe/stripe.service';

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);
  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly organizationRepository: Repository<OrganizationEntity>,
    private readonly stripeService: StripeService,
    private readonly utilityService: UtilityService,
    private readonly userService: UserService,
    private readonly planService: PlanService,
    private readonly auditLogService: AuditLogService,
    private readonly dispatcher: WebhookDispatcherService,
  ) {}

  async getAll(where?: any): Promise<OrganizationEntity[]> {
    return this.organizationRepository.find({ where });
  }

  async getOneBy(where: any): Promise<OrganizationEntity | null> {
    return this.organizationRepository.findOne({ where });
  }

  async getByName(name: string): Promise<OrganizationEntity | null> {
    return this.organizationRepository.findOne({ where: { name } });
  }

  async getBySlug(slug: string): Promise<OrganizationEntity | null> {
    return this.organizationRepository.findOne({ where: { slug } });
  }

  async getById(id: string): Promise<OrganizationEntity | null> {
    return this.organizationRepository.findOne({
      where: { id },
      relations: ['plan'],
    });
  }

  async create(
    organizationDto: CreateOrganizationDto,
  ): Promise<OrganizationEntity> {
    const organization = this.organizationRepository.create({
      ...organizationDto,
    });
    return this.organizationRepository.save(organization);
  }

  async getDetails(user: UserInfoDto): Promise<OrganizationEntity> {
    return await this.organizationRepository.findOne({
      where: { id: user.orgId, isActive: true },
      relations: ['plan'],
    });
  }

  async getMemberLimitInfo(
    user: UserInfoDto,
  ): Promise<{ plan: PlanEntity; count: number }> {
    const { orgId } = user;
    const { plan } = await this.getDetails(user);
    const count = await this.userService.getTotalActiveUsers(orgId);
    return { plan, count };
  }

  async updateName(
    auditContext: AuditContextDto,
    user: UserInfoDto,
    body: UpdateOrganizationDto,
  ): Promise<OrganizationEntity> {
    let slug = this.utilityService.generateSlug(body.name);
    const existingOrganization = await this.getBySlug(slug);
    if (existingOrganization) {
      slug = this.utilityService.generateSlug(body.name, true);
    }
    const organization = await this.getById(user.orgId);
    if (!organization) throw new NotFoundException('Organization not found');
    const oldName = organization.name;

    this.organizationRepository.merge(organization, {
      id: organization.id,
      name: body.name,
      slug,
    });

    this.auditLogService
      .create({
        ...auditContext,
        action: AuditAction.ORG_UPDATED,
        resourceType: AuditResourceType.ORGANIZATION,
        resourceId: organization.id,
        organization,
      })
      .catch(() => {
        this.logger.error('Error creating audit log for organization update');
      });

    this.dispatcher
      .dispatch(user.orgId, WebhookEvent.ORG_UPDATED, {
        oldName,
        newName: body.name,
      })
      .catch((error) => {
        this.logger.error('Error dispatching webhook', error);
      });
    return this.organizationRepository.save(organization);
  }

  async updateFields(
    id: string,
    fields: Partial<OrganizationEntity>,
  ): Promise<void> {
    await this.organizationRepository.update(id, fields);
  }

  async updatePlan(
    auditContext: AuditContextDto,
    user: UserInfoDto,
    body: UpdatePlanDto,
  ): Promise<OrganizationEntity> {
    const organization = await this.getById(user.orgId);
    if (!organization) throw new NotFoundException('Organization not found');

    const { stripeSubscriptionId, paymentStatus } = organization;
    const hasActivePayment =
      !!stripeSubscriptionId &&
      [PaymentStatus.ACTIVE, PaymentStatus.TRIAL].includes(paymentStatus);

    if (!hasActivePayment) {
      throw new ForbiddenException(
        'No active subscription found. Please subscribe before changing your plan.',
      );
    }

    const newPlan = await this.planService.getByName(body.plan);
    if (!newPlan) throw new NotFoundException('Plan not found');
    if (organization.plan?.id === newPlan.id) {
      throw new BadRequestException('Plan is already active');
    }

    await this.stripeService.updateSubscription(
      stripeSubscriptionId,
      newPlan.stripePriceId,
    );

    organization.plan = newPlan;
    if (paymentStatus === PaymentStatus.TRIAL) {
      organization.paymentStatus = PaymentStatus.ACTIVE;
      organization.trialEndsAt = null;
    }
    return this.organizationRepository.save(organization);
  }
}
