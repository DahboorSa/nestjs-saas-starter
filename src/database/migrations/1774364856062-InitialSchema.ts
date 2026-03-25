import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1774364856062 implements MigrationInterface {
  name = 'InitialSchema1774364856062';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."invitations_role_enum" AS ENUM('owner', 'admin', 'member')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."invitations_status_enum" AS ENUM('pending', 'accepted', 'expired')`,
    );
    await queryRunner.query(
      `CREATE TABLE "invitations" ("id" SERIAL NOT NULL, "email" character varying NOT NULL, "role" "public"."invitations_role_enum" NOT NULL, "token" character varying NOT NULL, "status" "public"."invitations_status_enum" NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "organizationId" uuid, "invitedByUserId" uuid, CONSTRAINT "PK_5dec98cfdfd562e4ad3648bbb07" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b9139f00cebfadced76bca3084" ON "invitations" ("organizationId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('owner', 'admin', 'member')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL, "isVerified" boolean NOT NULL DEFAULT false, "lastLoginAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean NOT NULL DEFAULT true, "firstName" character varying, "lastName" character varying, "userName" character varying, "organizationId" uuid, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_226bb9aa7aa8a69991209d58f59" UNIQUE ("userName"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f3d6aea8fcca58182b2e80ce97" ON "users" ("organizationId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_logs_action_enum" AS ENUM('auth.register', 'auth.login', 'auth.change_password', 'auth.forgot_password', 'auth.reset_password', 'auth.logout', 'auth.verify_email', 'auth.resend_verify_email', 'auth.refresh_token', 'org.updated', 'member.invited', 'member.invite_accepted', 'member.role_updated', 'member.updated', 'member.email_updated', 'member.removed', 'apikey.created', 'apikey.revoked', 'plan.limit_exceeded', 'webhook.created', 'webhook.delivered', 'webhook.deleted')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_logs_resourcetype_enum" AS ENUM('organization', 'user', 'invitation', 'api_key', 'plan', 'webhook')`,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" SERIAL NOT NULL, "action" "public"."audit_logs_action_enum" NOT NULL, "resourceType" "public"."audit_logs_resourcetype_enum" NOT NULL, "resourceId" character varying NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}', "ipAddress" character varying, "userAgent" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "organizationId" uuid, "userId" uuid, "apiKeyId" integer, CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "api_keys" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "keyHash" character varying NOT NULL, "keyPrefix" character varying NOT NULL, "scopes" jsonb NOT NULL, "lastUsedAt" TIMESTAMP, "isActive" boolean NOT NULL DEFAULT true, "expiresAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "organizationId" uuid, CONSTRAINT "PK_5c8a79801b44bd27b79228e1dad" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_df3b25181df0b4b59bd93f16e1" ON "api_keys" ("keyHash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1888b4544f52d274e98f6f1aa6" ON "api_keys" ("organizationId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "plans" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "price" integer NOT NULL, "limits" jsonb NOT NULL, "features" jsonb NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "isDefault" boolean DEFAULT false, CONSTRAINT "PK_3720521a81c7c24fe9b7202ba61" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."usage_records_metric_enum" AS ENUM('api_calls', 'webhook_calls', 'data_storage', 'active_users')`,
    );
    await queryRunner.query(
      `CREATE TABLE "usage_records" ("id" SERIAL NOT NULL, "metric" "public"."usage_records_metric_enum" NOT NULL, "value" integer NOT NULL, "period" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "organizationId" uuid NOT NULL, CONSTRAINT "UQ_5ed87ee9a067c0d25b59f0dc35d" UNIQUE ("organizationId", "metric", "period"), CONSTRAINT "PK_e511cf9f7dc53851569f87467a5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_139b12af7ac259044807889d06" ON "usage_records" ("organizationId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "organizations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "slug" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "trialEndsAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "planId" integer, CONSTRAINT "UQ_963693341bd612aa01ddf3a4b68" UNIQUE ("slug"), CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "webhook_endpoints" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "url" character varying NOT NULL, "secret" character varying NOT NULL, "events" jsonb NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "organizationId" uuid, CONSTRAINT "PK_054c4cfb95223732f5939d2d546" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2bf25c8e57515f3d8662d6159c" ON "webhook_endpoints" ("organizationId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."webhook_deliveries_status_enum" AS ENUM('success', 'pending', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "webhook_deliveries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "event" character varying NOT NULL, "payload" jsonb NOT NULL, "statusCode" integer, "attempt" integer NOT NULL, "status" "public"."webhook_deliveries_status_enum" NOT NULL, "deliveredAt" TIMESTAMP NOT NULL DEFAULT now(), "webhookEndpointId" uuid, CONSTRAINT "PK_535dd409947fb6d8fc6dfc0112a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e4dca936b75c3f9d0d38ff1845" ON "webhook_deliveries" ("webhookEndpointId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "invitations" ADD CONSTRAINT "FK_b9139f00cebfadced76bca3084f" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitations" ADD CONSTRAINT "FK_b7423cfb362a842b7ea0a3763b9" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_f3d6aea8fcca58182b2e80ce979" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_2d031e6155834882f54dcd6b4f5" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_cfa83f61e4d27a87fcae1e025ab" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_741fa976d1e04e695f3aa23cb89" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_keys" ADD CONSTRAINT "FK_1888b4544f52d274e98f6f1aa62" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "usage_records" ADD CONSTRAINT "FK_139b12af7ac259044807889d062" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizations" ADD CONSTRAINT "FK_98b5c76732833827055b1f147d3" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "FK_2bf25c8e57515f3d8662d6159ce" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "FK_e4dca936b75c3f9d0d38ff18457" FOREIGN KEY ("webhookEndpointId") REFERENCES "webhook_endpoints"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "webhook_deliveries" DROP CONSTRAINT "FK_e4dca936b75c3f9d0d38ff18457"`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_endpoints" DROP CONSTRAINT "FK_2bf25c8e57515f3d8662d6159ce"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizations" DROP CONSTRAINT "FK_98b5c76732833827055b1f147d3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usage_records" DROP CONSTRAINT "FK_139b12af7ac259044807889d062"`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_keys" DROP CONSTRAINT "FK_1888b4544f52d274e98f6f1aa62"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_741fa976d1e04e695f3aa23cb89"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_cfa83f61e4d27a87fcae1e025ab"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_2d031e6155834882f54dcd6b4f5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_f3d6aea8fcca58182b2e80ce979"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitations" DROP CONSTRAINT "FK_b7423cfb362a842b7ea0a3763b9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitations" DROP CONSTRAINT "FK_b9139f00cebfadced76bca3084f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e4dca936b75c3f9d0d38ff1845"`,
    );
    await queryRunner.query(`DROP TABLE "webhook_deliveries"`);
    await queryRunner.query(
      `DROP TYPE "public"."webhook_deliveries_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2bf25c8e57515f3d8662d6159c"`,
    );
    await queryRunner.query(`DROP TABLE "webhook_endpoints"`);
    await queryRunner.query(`DROP TABLE "organizations"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_139b12af7ac259044807889d06"`,
    );
    await queryRunner.query(`DROP TABLE "usage_records"`);
    await queryRunner.query(`DROP TYPE "public"."usage_records_metric_enum"`);
    await queryRunner.query(`DROP TABLE "plans"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1888b4544f52d274e98f6f1aa6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_df3b25181df0b4b59bd93f16e1"`,
    );
    await queryRunner.query(`DROP TABLE "api_keys"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(
      `DROP TYPE "public"."audit_logs_resourcetype_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."audit_logs_action_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f3d6aea8fcca58182b2e80ce97"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b9139f00cebfadced76bca3084"`,
    );
    await queryRunner.query(`DROP TABLE "invitations"`);
    await queryRunner.query(`DROP TYPE "public"."invitations_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."invitations_role_enum"`);
  }
}
