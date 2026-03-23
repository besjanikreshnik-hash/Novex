import { MigrationInterface, QueryRunner } from 'typeorm';

export class FundingLifecycle1700000000007 implements MigrationInterface {
  name = 'FundingLifecycle1700000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Enums ───────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "deposit_status_enum" AS ENUM ('pending', 'confirming', 'credited', 'failed');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "withdrawal_status_enum" AS ENUM ('pending', 'hold', 'approved', 'processing', 'completed', 'rejected', 'failed');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // ── Deposit Addresses ───────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "deposit_addresses" (
        "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"    UUID NOT NULL,
        "asset"      VARCHAR(10) NOT NULL,
        "network"    VARCHAR(20) NOT NULL,
        "address"    VARCHAR(200) NOT NULL UNIQUE,
        "memo"       VARCHAR(100),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_depaddr_user" ON "deposit_addresses" ("user_id", "asset", "network")`);

    // ── Deposits ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "deposits" (
        "id"                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"                UUID NOT NULL,
        "asset"                  VARCHAR(10) NOT NULL,
        "network"                VARCHAR(20) NOT NULL,
        "tx_hash"                VARCHAR(100) NOT NULL UNIQUE,
        "address"                VARCHAR(200) NOT NULL,
        "amount"                 DECIMAL(36,18) NOT NULL,
        "confirmations"          SMALLINT NOT NULL DEFAULT 0,
        "required_confirmations" SMALLINT NOT NULL,
        "status"                 deposit_status_enum NOT NULL DEFAULT 'pending',
        "credited_at"            TIMESTAMPTZ,
        "created_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_dep_user" ON "deposits" ("user_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_dep_status" ON "deposits" ("status")`);

    // ── Withdrawals ─────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "withdrawals" (
        "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"        UUID NOT NULL,
        "asset"          VARCHAR(10) NOT NULL,
        "network"        VARCHAR(20) NOT NULL,
        "address"        VARCHAR(200) NOT NULL,
        "memo"           VARCHAR(100),
        "amount"         DECIMAL(36,18) NOT NULL,
        "fee"            DECIMAL(36,18) NOT NULL,
        "tx_hash"        VARCHAR(100),
        "status"         withdrawal_status_enum NOT NULL DEFAULT 'pending',
        "risk_score"     DECIMAL(3,2),
        "reviewed_by"    UUID,
        "review_note"    TEXT,
        "reviewed_at"    TIMESTAMPTZ,
        "is_new_address" BOOLEAN NOT NULL DEFAULT false,
        "hold_until"     TIMESTAMPTZ,
        "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_wd_user" ON "withdrawals" ("user_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_wd_status" ON "withdrawals" ("status")`);

    // ── Withdrawal Address Book ─────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "withdrawal_address_book" (
        "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"       UUID NOT NULL,
        "asset"         VARCHAR(10) NOT NULL,
        "network"       VARCHAR(20) NOT NULL,
        "address"       VARCHAR(200) NOT NULL,
        "label"         VARCHAR(100),
        "first_used_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE ("user_id", "asset", "network", "address")
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "withdrawal_address_book" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "withdrawals" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "deposits" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "deposit_addresses" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "withdrawal_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "deposit_status_enum"`);
  }
}
