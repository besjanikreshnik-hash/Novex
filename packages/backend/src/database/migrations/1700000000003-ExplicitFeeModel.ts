import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NovEx — Explicit Fee Accounting Model
 *
 * Replaces the ambiguous makerFee/takerFee columns with explicit,
 * asset-tagged fee fields and a platform fee ledger table.
 */
export class ExplicitFeeModel1700000000003 implements MigrationInterface {
  name = 'ExplicitFeeModel1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Rename old columns, add new explicit columns ────
    // Drop old columns
    await queryRunner.query(`ALTER TABLE "trades" DROP COLUMN IF EXISTS "quantity"`);
    await queryRunner.query(`ALTER TABLE "trades" DROP COLUMN IF EXISTS "quote_quantity"`);
    await queryRunner.query(`ALTER TABLE "trades" DROP COLUMN IF EXISTS "maker_fee"`);
    await queryRunner.query(`ALTER TABLE "trades" DROP COLUMN IF EXISTS "taker_fee"`);

    // Add new explicit columns
    await queryRunner.query(`ALTER TABLE "trades" ADD COLUMN "gross_base" DECIMAL(36,18) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "trades" ADD COLUMN "gross_quote" DECIMAL(36,18) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "trades" ADD COLUMN "buyer_fee_amount" DECIMAL(36,18) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "trades" ADD COLUMN "buyer_fee_asset" VARCHAR(10) NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "trades" ADD COLUMN "seller_fee_amount" DECIMAL(36,18) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "trades" ADD COLUMN "seller_fee_asset" VARCHAR(10) NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "trades" ADD COLUMN "maker_fee_rate" DECIMAL(36,18) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "trades" ADD COLUMN "taker_fee_rate" DECIMAL(36,18) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "trades" ADD COLUMN "buyer_user_id" UUID`);
    await queryRunner.query(`ALTER TABLE "trades" ADD COLUMN "seller_user_id" UUID`);

    // ── STP (Self-Trade Prevention) config column on trading_pairs ──
    await queryRunner.query(`
      ALTER TABLE "trading_pairs"
      ADD COLUMN "stp_mode" VARCHAR(20) NOT NULL DEFAULT 'cancel_taker'
    `);

    // ── Platform Fee Ledger ─────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "fee_ledger" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "trade_id"    UUID NOT NULL REFERENCES "trades"("id"),
        "asset"       VARCHAR(10) NOT NULL,
        "amount"      DECIMAL(36,18) NOT NULL,
        "source"      VARCHAR(20) NOT NULL,
        "user_id"     UUID NOT NULL,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_fee_ledger_asset" ON "fee_ledger" ("asset", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_fee_ledger_trade" ON "fee_ledger" ("trade_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "fee_ledger" CASCADE`);
    await queryRunner.query(`ALTER TABLE "trading_pairs" DROP COLUMN IF EXISTS "stp_mode"`);
    await queryRunner.query(`ALTER TABLE "trades" DROP COLUMN IF EXISTS "seller_user_id"`);
    await queryRunner.query(`ALTER TABLE "trades" DROP COLUMN IF EXISTS "buyer_user_id"`);
    await queryRunner.query(`ALTER TABLE "trades" DROP COLUMN IF EXISTS "taker_fee_rate"`);
    await queryRunner.query(`ALTER TABLE "trades" DROP COLUMN IF EXISTS "maker_fee_rate"`);
    await queryRunner.query(`ALTER TABLE "trades" DROP COLUMN IF EXISTS "seller_fee_asset"`);
    await queryRunner.query(`ALTER TABLE "trades" DROP COLUMN IF EXISTS "seller_fee_amount"`);
    await queryRunner.query(`ALTER TABLE "trades" DROP COLUMN IF EXISTS "buyer_fee_asset"`);
    await queryRunner.query(`ALTER TABLE "trades" DROP COLUMN IF EXISTS "buyer_fee_amount"`);
    await queryRunner.query(`ALTER TABLE "trades" DROP COLUMN IF EXISTS "gross_quote"`);
    await queryRunner.query(`ALTER TABLE "trades" DROP COLUMN IF EXISTS "gross_base"`);
    // Restore old columns
    await queryRunner.query(`ALTER TABLE "trades" ADD COLUMN "quantity" DECIMAL(36,18) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "trades" ADD COLUMN "quote_quantity" DECIMAL(36,18) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "trades" ADD COLUMN "maker_fee" DECIMAL(36,18) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "trades" ADD COLUMN "taker_fee" DECIMAL(36,18) NOT NULL DEFAULT 0`);
  }
}
