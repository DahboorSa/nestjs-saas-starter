import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropOrganizationSlug1790000000300 implements MigrationInterface {
  name = 'DropOrganizationSlug1790000000300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "slug"`);
  }

  // Slugs were random and unused, so the id stands in to satisfy NOT NULL and UNIQUE.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organizations" ADD "slug" character varying`,
    );
    await queryRunner.query(`UPDATE "organizations" SET "slug" = "id"::text`);
    await queryRunner.query(
      `ALTER TABLE "organizations" ALTER COLUMN "slug" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizations" ADD CONSTRAINT "UQ_963693341bd612aa01ddf3a4b68" UNIQUE ("slug")`,
    );
  }
}
