import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NovEx — Market order support: max_quantity and min_notional on trading_pairs.
 */
export class MarketOrderSupport1700000000006 implements MigrationInterface {
  name = 'MarketOrderSupport1700000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "trading_pairs"
      ADD COLUMN IF NOT EXISTS "max_quantity" DECIMAL(36,18) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "trading_pairs"
      ADD COLUMN IF NOT EXISTS "min_notional" DECIMAL(36,18) NOT NULL DEFAULT 10
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "trading_pairs" DROP COLUMN IF EXISTS "min_notional"`);
    await queryRunner.query(`ALTER TABLE "trading_pairs" DROP COLUMN IF EXISTS "max_quantity"`);
  }
}
