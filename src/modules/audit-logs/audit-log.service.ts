import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, MoreThanOrEqual, Not, In, Repository } from 'typeorm';
import { AuditLogEntity } from './entities/audit-log.entity';
import { AuditAction } from '../../enums';

const AUTH_ACTIONS = Object.entries(AuditAction)
  .filter(([key]) => key.startsWith('AUTH_'))
  .map(([, value]) => value as AuditAction);

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepository: Repository<AuditLogEntity>,
  ) {}

  async create(auditLog: Partial<AuditLogEntity>) {
    const auditLogData = this.auditLogRepository.create({
      ...auditLog,
    });
    await this.auditLogRepository.save(auditLogData);
  }

  async findByOrganization(
    orgId: string,
    from?: string,
    to?: string,
  ): Promise<AuditLogEntity[]> {
    const fromDate = from
      ? new Date(from)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);

    const createdAt = to
      ? Between(fromDate, new Date(to))
      : MoreThanOrEqual(fromDate);

    return this.auditLogRepository.find({
      where: {
        organization: { id: orgId },
        action: Not(In(AUTH_ACTIONS)),
        createdAt,
      },
      select: ['action', 'resourceType', 'resourceId', 'metadata', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
  }
}
