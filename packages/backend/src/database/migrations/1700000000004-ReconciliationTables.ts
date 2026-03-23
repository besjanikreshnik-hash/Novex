import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NovEx — Reconciliation run and mismatch tables.
 */
export class ReconciliationTables1700000000004 implements MigrationInterface {
  name = 'ReconciliationTables1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Enum ────────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "reconciliation_status_enum" AS ENUM ('running', 'passed', 'failed', 'error');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "mismatch_type_enum" AS ENUM (
          'negative_available', 'negative_locked',
          'fee_ledger_treasury_mismatch', 'missing_fee_ledger_entry',
          'order_overfill', 'trade_quote_mismatch',
          'settlement_balance_drift'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ── Reconciliation Runs ─────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "reconciliation_runs" (
        "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "status"          reconciliation_status_enum NOT NULL DEFAULT 'running',
        "finished_at"     TIMESTAMPTZ,
        "assets_checked"  VARCHAR(500) NOT NULL DEFAULT '',
        "mismatch_count"  INTEGER NOT NULL DEFAULT 0,
        "checks_executed" INTEGER NOT NULL DEFAULT 0,
        "trigger"         VARCHAR(20) NOT NULL DEFAULT 'api',
        "error_message"   TEXT,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ── Reconciliation Mismatches ───────────────────────
    await queryRunner.query(`
      CREATE TABLE "reconciliation_mismatches" (
        "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "run_id"          UUID NOT NULL REFERENCES "reconciliation_runs"("id") ON DELETE CASCADE,
        "mismatch_type"   mismatch_type_enum NOT NULL,
        "asset"           VARCHAR(10) NOT NULL,
        "description"     TEXT NOT NULL,
        "expected_value"  VARCHAR(100) NOT NULL,
        "actual_value"    VARCHAR(100) NOT NULL,
        "difference"      VARCHAR(100) NOT NULL,
        "reference_id"    UUID,
        "reference_type"  VARCHAR(30),
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_recon_mismatch_run" ON "reconciliation_mismatches" ("run_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_recon_mismatch_type" ON "reconciliation_mismatches" ("mismatch_type")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "reconciliation_mismatches" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reconciliation_runs" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "mismatch_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "reconciliation_status_enum"`);
  }
}
