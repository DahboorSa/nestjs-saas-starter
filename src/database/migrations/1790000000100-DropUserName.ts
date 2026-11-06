import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropUserName1790000000100 implements MigrationInterface {
  name = 'DropUserName1790000000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "user_name"`);
  }

  // Not restored: a backfill from the email would violate the unique constraint.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "user_name" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_226bb9aa7aa8a69991209d58f59" UNIQUE ("user_name")`,
    );
  }
}
