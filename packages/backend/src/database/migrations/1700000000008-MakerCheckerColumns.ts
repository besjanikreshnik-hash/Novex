import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakerCheckerColumns1700000000008 implements MigrationInterface {
  name = 'MakerCheckerColumns1700000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "withdrawals"
      ADD COLUMN IF NOT EXISTS "processed_by" UUID,
      ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "withdrawals"
      DROP COLUMN IF EXISTS "processed_at",
      DROP COLUMN IF EXISTS "processed_by"
    `);
  }
}
