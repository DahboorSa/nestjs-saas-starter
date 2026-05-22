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
  @Column({ name: 'password_hash' })
  passwordHash: string;
  @Column({
    type: 'enum',
    enum: UserRole,
  })
  role: UserRole;
  @Column({ default: false, name: 'is_verified' })
  isVerified: boolean;
  @Column({ type: 'timestamp', nullable: true, name: 'last_login_at' })
  lastLoginAt: Date;
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
  @Column({ default: true, name: 'is_active' })
  isActive: boolean;
  @Column({ nullable: true, name: 'first_name' })
  firstName: string;
  @Column({ nullable: true, name: 'last_name' })
  lastName: string;
  @Column({ nullable: true, unique: true, name: 'user_name' })
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
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;
}
