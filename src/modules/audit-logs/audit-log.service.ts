import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from './entities/audit-log.entity';

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
}
