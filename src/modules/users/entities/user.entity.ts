import { UserRole } from '../../../enums';
import { AuditLogEntity } from '../../../modules/audit-logs/entities/audit-log.entity';
import { InvitationEntity } from '../../../modules/invitations/entities/invitation.entity';
import { OrganizationEntity } from '../../../modules/organizations/entities/organization.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ unique: true })
  email: string;
  @Column()
  passwordHash: string;
  @Column({
    type: 'enum',
    enum: UserRole,
  })
  role: UserRole;
  @Column({ default: false })
  isVerified: boolean;
  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date;
  @CreateDateColumn()
  createdAt: Date;
  @UpdateDateColumn()
  updatedAt: Date;
  @Column({ default: true })
  isActive: boolean;
  @Column({ nullable: true })
  firstName: string;
  @Column({ nullable: true })
  lastName: string;
  @Column({ nullable: true, unique: true })
  userName: string;

  @OneToMany(() => AuditLogEntity, (auditLog) => auditLog.user)
  auditLogs: AuditLogEntity[];

  @OneToMany(
    () => InvitationEntity,
    (invitationEntity) => invitationEntity.invitedBy,
  )
  invitations: InvitationEntity[];

  @Index()
  @ManyToOne(() => OrganizationEntity, (organization) => organization.users)
  @JoinColumn({ name: 'organizationId' })
  organization: OrganizationEntity;
}
