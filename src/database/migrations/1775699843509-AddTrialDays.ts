import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTrialDays1775699843509 implements MigrationInterface {
    name = 'AddTrialDays1775699843509'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "plans" ADD "trialDays" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "trialDays"`);
    }

}
