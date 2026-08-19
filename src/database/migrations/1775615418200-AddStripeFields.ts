import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStripeFields1775615418200 implements MigrationInterface {
    name = 'AddStripeFields1775615418200'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "plans" ADD "stripePriceId" character varying`);
        await queryRunner.query(`ALTER TABLE "organizations" ADD "stripeCustomerId" character varying`);
        await queryRunner.query(`ALTER TABLE "organizations" ADD "stripeSubscriptionId" character varying`);
        await queryRunner.query(`CREATE TYPE "public"."organizations_paymentstatus_enum" AS ENUM('FREE', 'TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "organizations" ADD "paymentStatus" "public"."organizations_paymentstatus_enum" NOT NULL DEFAULT 'FREE'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "paymentStatus"`);
        await queryRunner.query(`DROP TYPE "public"."organizations_paymentstatus_enum"`);
        await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "stripeSubscriptionId"`);
        await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "stripeCustomerId"`);
        await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "stripePriceId"`);
    }

}
