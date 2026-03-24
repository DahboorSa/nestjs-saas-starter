import { AuditLogEntity } from '../../../modules/audit-logs/entities/audit-log.entity';
import { OrganizationEntity } from '../../../modules/organizations/entities/organization.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('api_keys')
export class ApiKeyEntity {
  @PrimaryGeneratedColumn()
  id: number;
  @Column()
  name: string;
  @Index()
  @Column()
  keyHash: string;
  @Column()
  keyPrefix: string;
  @Column({ type: 'jsonb' })
  scopes: string[];
  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt: Date;
  @Column({ default: true })
  isActive: boolean;
  @Column({ nullable: true })
  expiresAt: Date;
  @CreateDateColumn()
  createdAt: Date;

  @Index()
  @ManyToOne(() => OrganizationEntity, (organization) => organization.apiKeys)
  @JoinColumn({ name: 'organizationId' })
  organization: OrganizationEntity;

  @OneToMany(() => AuditLogEntity, (auditLogEntity) => auditLogEntity.apiKey)
  auditLogs: AuditLogEntity[];
}
