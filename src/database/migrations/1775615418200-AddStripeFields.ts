import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStripeFields1775615418200 implements MigrationInterface {
    name = 'AddStripeFields1775615418200'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "plans" ADD "stripePriceId" character varying`);
        await queryRunner.query(`ALTER TYPE "public"."organizations_paymentstatus_enum" RENAME TO "organizations_paymentstatus_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."organizations_paymentstatus_enum" AS ENUM('FREE', 'TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "organizations" ALTER COLUMN "paymentStatus" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "organizations" ALTER COLUMN "paymentStatus" TYPE "public"."organizations_paymentstatus_enum" USING "paymentStatus"::"text"::"public"."organizations_paymentstatus_enum"`);
        await queryRunner.query(`ALTER TABLE "organizations" ALTER COLUMN "paymentStatus" SET DEFAULT 'FREE'`);
        await queryRunner.query(`DROP TYPE "public"."organizations_paymentstatus_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."organizations_paymentstatus_enum_old" AS ENUM('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "organizations" ALTER COLUMN "paymentStatus" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "organizations" ALTER COLUMN "paymentStatus" TYPE "public"."organizations_paymentstatus_enum_old" USING "paymentStatus"::"text"::"public"."organizations_paymentstatus_enum_old"`);
        await queryRunner.query(`ALTER TABLE "organizations" ALTER COLUMN "paymentStatus" SET DEFAULT 'TRIAL'`);
        await queryRunner.query(`DROP TYPE "public"."organizations_paymentstatus_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."organizations_paymentstatus_enum_old" RENAME TO "organizations_paymentstatus_enum"`);
        await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "stripePriceId"`);
    }

}
