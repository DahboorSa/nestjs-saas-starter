import { MigrationInterface, QueryRunner } from 'typeorm';

export class HashInvitationToken1790000000200 implements MigrationInterface {
  name = 'HashInvitationToken1790000000200';

  // Hashed in place (same SHA-256 as hashToken) so emailed links keep working.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invitations" RENAME COLUMN "token" TO "token_hash"`,
    );
    await queryRunner.query(
      `UPDATE "invitations" SET "token_hash" = encode(sha256(convert_to("token_hash", 'UTF8')), 'hex')`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_invitations_token_hash" ON "invitations" ("token_hash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_invitations_token_hash"`);
    await queryRunner.query(
      `ALTER TABLE "invitations" RENAME COLUMN "token_hash" TO "token"`,
    );
  }
}
