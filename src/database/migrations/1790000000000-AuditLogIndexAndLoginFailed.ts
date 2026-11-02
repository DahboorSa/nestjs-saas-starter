import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditLogIndexAndLoginFailed1790000000000
  implements MigrationInterface
{
  name = 'AuditLogIndexAndLoginFailed1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_organization_created_at" ON "audit_logs" ("organization_id", "created_at") `,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'auth.login_failed' AFTER 'auth.login'`,
    );
  }

  // Postgres cannot drop a single enum value, so rebuild the type without it.
  // Rows using the value are deleted first or the cast below would fail.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "audit_logs" WHERE "action" = 'auth.login_failed'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."audit_logs_action_enum" RENAME TO "audit_logs_action_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_logs_action_enum" AS ENUM('auth.register', 'auth.login', 'auth.change_password', 'auth.forgot_password', 'auth.reset_password', 'auth.logout', 'auth.verify_email', 'auth.resend_verify_email', 'auth.refresh_token', 'org.updated', 'member.invited', 'member.invite_accepted', 'member.role_updated', 'member.updated', 'member.email_updated', 'member.removed', 'apikey.created', 'apikey.revoked', 'plan.limit_exceeded', 'plan.upgraded', 'plan.downgraded', 'api.limit_exceeded', 'webhook.created', 'webhook.delivered', 'webhook.deleted')`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ALTER COLUMN "action" TYPE "public"."audit_logs_action_enum" USING "action"::"text"::"public"."audit_logs_action_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."audit_logs_action_enum_old"`);
    await queryRunner.query(
      `DROP INDEX "IDX_audit_logs_organization_created_at"`,
    );
  }
}
