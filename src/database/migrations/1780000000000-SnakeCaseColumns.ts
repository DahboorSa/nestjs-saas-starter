import { MigrationInterface, QueryRunner } from 'typeorm';

export class SnakeCaseColumns1780000000000 implements MigrationInterface {
  name = 'SnakeCaseColumns1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename enum types to match new snake_case column names
    await queryRunner.query(
      `ALTER TYPE "public"."organizations_paymentstatus_enum" RENAME TO "organizations_payment_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."audit_logs_resourcetype_enum" RENAME TO "audit_logs_resource_type_enum"`,
    );

    // users
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "passwordHash" TO "password_hash"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "isVerified" TO "is_verified"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "lastLoginAt" TO "last_login_at"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "createdAt" TO "created_at"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "updatedAt" TO "updated_at"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "isActive" TO "is_active"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "firstName" TO "first_name"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "lastName" TO "last_name"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "userName" TO "user_name"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "organizationId" TO "organization_id"`);

    // organizations
    await queryRunner.query(`ALTER TABLE "organizations" RENAME COLUMN "stripeCustomerId" TO "stripe_customer_id"`);
    await queryRunner.query(`ALTER TABLE "organizations" RENAME COLUMN "stripeSubscriptionId" TO "stripe_subscription_id"`);
    await queryRunner.query(`ALTER TABLE "organizations" RENAME COLUMN "paymentStatus" TO "payment_status"`);
    await queryRunner.query(`ALTER TABLE "organizations" RENAME COLUMN "isActive" TO "is_active"`);
    await queryRunner.query(`ALTER TABLE "organizations" RENAME COLUMN "trialEndsAt" TO "trial_ends_at"`);
    await queryRunner.query(`ALTER TABLE "organizations" RENAME COLUMN "createdAt" TO "created_at"`);
    await queryRunner.query(`ALTER TABLE "organizations" RENAME COLUMN "updatedAt" TO "updated_at"`);
    await queryRunner.query(`ALTER TABLE "organizations" RENAME COLUMN "planId" TO "plan_id"`);

    // plans
    await queryRunner.query(`ALTER TABLE "plans" RENAME COLUMN "stripePriceId" TO "stripe_price_id"`);
    await queryRunner.query(`ALTER TABLE "plans" RENAME COLUMN "trialDays" TO "trial_days"`);
    await queryRunner.query(`ALTER TABLE "plans" RENAME COLUMN "isActive" TO "is_active"`);
    await queryRunner.query(`ALTER TABLE "plans" RENAME COLUMN "createdAt" TO "created_at"`);
    await queryRunner.query(`ALTER TABLE "plans" RENAME COLUMN "isDefault" TO "is_default"`);

    // api_keys
    await queryRunner.query(`ALTER TABLE "api_keys" RENAME COLUMN "keyHash" TO "key_hash"`);
    await queryRunner.query(`ALTER TABLE "api_keys" RENAME COLUMN "keyPrefix" TO "key_prefix"`);
    await queryRunner.query(`ALTER TABLE "api_keys" RENAME COLUMN "lastUsedAt" TO "last_used_at"`);
    await queryRunner.query(`ALTER TABLE "api_keys" RENAME COLUMN "isActive" TO "is_active"`);
    await queryRunner.query(`ALTER TABLE "api_keys" RENAME COLUMN "expiresAt" TO "expires_at"`);
    await queryRunner.query(`ALTER TABLE "api_keys" RENAME COLUMN "createdAt" TO "created_at"`);
    await queryRunner.query(`ALTER TABLE "api_keys" RENAME COLUMN "organizationId" TO "organization_id"`);

    // invitations
    await queryRunner.query(`ALTER TABLE "invitations" RENAME COLUMN "expiresAt" TO "expires_at"`);
    await queryRunner.query(`ALTER TABLE "invitations" RENAME COLUMN "createdAt" TO "created_at"`);
    await queryRunner.query(`ALTER TABLE "invitations" RENAME COLUMN "organizationId" TO "organization_id"`);
    await queryRunner.query(`ALTER TABLE "invitations" RENAME COLUMN "invitedByUserId" TO "invited_by_user_id"`);

    // webhook_endpoints
    await queryRunner.query(`ALTER TABLE "webhook_endpoints" RENAME COLUMN "isActive" TO "is_active"`);
    await queryRunner.query(`ALTER TABLE "webhook_endpoints" RENAME COLUMN "createdAt" TO "created_at"`);
    await queryRunner.query(`ALTER TABLE "webhook_endpoints" RENAME COLUMN "organizationId" TO "organization_id"`);

    // webhook_deliveries
    await queryRunner.query(`ALTER TABLE "webhook_deliveries" RENAME COLUMN "statusCode" TO "status_code"`);
    await queryRunner.query(`ALTER TABLE "webhook_deliveries" RENAME COLUMN "deliveredAt" TO "delivered_at"`);
    await queryRunner.query(`ALTER TABLE "webhook_deliveries" RENAME COLUMN "webhookEndpointId" TO "webhook_endpoint_id"`);

    // audit_logs
    await queryRunner.query(`ALTER TABLE "audit_logs" RENAME COLUMN "resourceType" TO "resource_type"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" RENAME COLUMN "resourceId" TO "resource_id"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" RENAME COLUMN "ipAddress" TO "ip_address"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" RENAME COLUMN "userAgent" TO "user_agent"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" RENAME COLUMN "createdAt" TO "created_at"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" RENAME COLUMN "organizationId" TO "organization_id"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" RENAME COLUMN "userId" TO "user_id"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" RENAME COLUMN "apiKeyId" TO "api_key_id"`);

    // usage_records
    await queryRunner.query(`ALTER TABLE "usage_records" RENAME COLUMN "createdAt" TO "created_at"`);
    await queryRunner.query(`ALTER TABLE "usage_records" RENAME COLUMN "organizationId" TO "organization_id"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // usage_records
    await queryRunner.query(`ALTER TABLE "usage_records" RENAME COLUMN "organization_id" TO "organizationId"`);
    await queryRunner.query(`ALTER TABLE "usage_records" RENAME COLUMN "created_at" TO "createdAt"`);

    // audit_logs
    await queryRunner.query(`ALTER TABLE "audit_logs" RENAME COLUMN "api_key_id" TO "apiKeyId"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" RENAME COLUMN "user_id" TO "userId"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" RENAME COLUMN "organization_id" TO "organizationId"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" RENAME COLUMN "created_at" TO "createdAt"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" RENAME COLUMN "user_agent" TO "userAgent"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" RENAME COLUMN "ip_address" TO "ipAddress"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" RENAME COLUMN "resource_id" TO "resourceId"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" RENAME COLUMN "resource_type" TO "resourceType"`);

    // webhook_deliveries
    await queryRunner.query(`ALTER TABLE "webhook_deliveries" RENAME COLUMN "webhook_endpoint_id" TO "webhookEndpointId"`);
    await queryRunner.query(`ALTER TABLE "webhook_deliveries" RENAME COLUMN "delivered_at" TO "deliveredAt"`);
    await queryRunner.query(`ALTER TABLE "webhook_deliveries" RENAME COLUMN "status_code" TO "statusCode"`);

    // webhook_endpoints
    await queryRunner.query(`ALTER TABLE "webhook_endpoints" RENAME COLUMN "organization_id" TO "organizationId"`);
    await queryRunner.query(`ALTER TABLE "webhook_endpoints" RENAME COLUMN "created_at" TO "createdAt"`);
    await queryRunner.query(`ALTER TABLE "webhook_endpoints" RENAME COLUMN "is_active" TO "isActive"`);

    // invitations
    await queryRunner.query(`ALTER TABLE "invitations" RENAME COLUMN "invited_by_user_id" TO "invitedByUserId"`);
    await queryRunner.query(`ALTER TABLE "invitations" RENAME COLUMN "organization_id" TO "organizationId"`);
    await queryRunner.query(`ALTER TABLE "invitations" RENAME COLUMN "created_at" TO "createdAt"`);
    await queryRunner.query(`ALTER TABLE "invitations" RENAME COLUMN "expires_at" TO "expiresAt"`);

    // api_keys
    await queryRunner.query(`ALTER TABLE "api_keys" RENAME COLUMN "organization_id" TO "organizationId"`);
    await queryRunner.query(`ALTER TABLE "api_keys" RENAME COLUMN "created_at" TO "createdAt"`);
    await queryRunner.query(`ALTER TABLE "api_keys" RENAME COLUMN "expires_at" TO "expiresAt"`);
    await queryRunner.query(`ALTER TABLE "api_keys" RENAME COLUMN "is_active" TO "isActive"`);
    await queryRunner.query(`ALTER TABLE "api_keys" RENAME COLUMN "last_used_at" TO "lastUsedAt"`);
    await queryRunner.query(`ALTER TABLE "api_keys" RENAME COLUMN "key_prefix" TO "keyPrefix"`);
    await queryRunner.query(`ALTER TABLE "api_keys" RENAME COLUMN "key_hash" TO "keyHash"`);

    // plans
    await queryRunner.query(`ALTER TABLE "plans" RENAME COLUMN "is_default" TO "isDefault"`);
    await queryRunner.query(`ALTER TABLE "plans" RENAME COLUMN "created_at" TO "createdAt"`);
    await queryRunner.query(`ALTER TABLE "plans" RENAME COLUMN "is_active" TO "isActive"`);
    await queryRunner.query(`ALTER TABLE "plans" RENAME COLUMN "trial_days" TO "trialDays"`);
    await queryRunner.query(`ALTER TABLE "plans" RENAME COLUMN "stripe_price_id" TO "stripePriceId"`);

    // organizations
    await queryRunner.query(`ALTER TABLE "organizations" RENAME COLUMN "plan_id" TO "planId"`);
    await queryRunner.query(`ALTER TABLE "organizations" RENAME COLUMN "updated_at" TO "updatedAt"`);
    await queryRunner.query(`ALTER TABLE "organizations" RENAME COLUMN "created_at" TO "createdAt"`);
    await queryRunner.query(`ALTER TABLE "organizations" RENAME COLUMN "trial_ends_at" TO "trialEndsAt"`);
    await queryRunner.query(`ALTER TABLE "organizations" RENAME COLUMN "is_active" TO "isActive"`);
    await queryRunner.query(`ALTER TABLE "organizations" RENAME COLUMN "payment_status" TO "paymentStatus"`);
    await queryRunner.query(`ALTER TABLE "organizations" RENAME COLUMN "stripe_subscription_id" TO "stripeSubscriptionId"`);
    await queryRunner.query(`ALTER TABLE "organizations" RENAME COLUMN "stripe_customer_id" TO "stripeCustomerId"`);

    // users
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "organization_id" TO "organizationId"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "user_name" TO "userName"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "last_name" TO "lastName"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "first_name" TO "firstName"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "is_active" TO "isActive"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "updated_at" TO "updatedAt"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "created_at" TO "createdAt"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "last_login_at" TO "lastLoginAt"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "is_verified" TO "isVerified"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "password_hash" TO "passwordHash"`);

    // Restore enum type names
    await queryRunner.query(
      `ALTER TYPE "public"."audit_logs_resource_type_enum" RENAME TO "audit_logs_resourcetype_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."organizations_payment_status_enum" RENAME TO "organizations_paymentstatus_enum"`,
    );
  }
}
