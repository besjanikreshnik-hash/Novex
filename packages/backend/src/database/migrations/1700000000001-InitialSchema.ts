import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NovEx — Initial Schema Migration
 *
 * Creates all core tables:
 *   users, wallets, trading_pairs, orders, trades, audit_logs
 *
 * This matches the entity definitions in the backend.
 */
export class InitialSchema1700000000001 implements MigrationInterface {
  name = 'InitialSchema1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Extensions ──────────────────────────────────────────
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // ── Enum Types ──────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "user_role_enum" AS ENUM ('user', 'admin');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "kyc_status_enum" AS ENUM ('none', 'pending', 'verified', 'rejected');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "order_side_enum" AS ENUM ('buy', 'sell');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "order_type_enum" AS ENUM ('limit', 'market');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "order_status_enum" AS ENUM ('open', 'partially_filled', 'filled', 'cancelled');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ── Users ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "email"               VARCHAR(255) NOT NULL,
        "password_hash"       VARCHAR(255) NOT NULL,
        "first_name"          VARCHAR(100),
        "last_name"           VARCHAR(100),
        "role"                user_role_enum NOT NULL DEFAULT 'user',
        "kyc_status"          kyc_status_enum NOT NULL DEFAULT 'none',
        "is_active"           BOOLEAN NOT NULL DEFAULT true,
        "two_factor_enabled"  BOOLEAN NOT NULL DEFAULT false,
        "refresh_token_hash"  VARCHAR,
        "last_login_at"       TIMESTAMPTZ,
        "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_users_email" ON "users" ("email")`);

    // ── Wallets ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "wallets" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"     UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "currency"    VARCHAR(20) NOT NULL,
        "available"   DECIMAL(36,18) NOT NULL DEFAULT 0,
        "locked"      DECIMAL(36,18) NOT NULL DEFAULT 0,
        "version"     INTEGER NOT NULL DEFAULT 1,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "UQ_wallets_user_currency" UNIQUE ("user_id", "currency")
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_wallets_user" ON "wallets" ("user_id")`);

    // ── Trading Pairs ───────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "trading_pairs" (
        "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "symbol"              VARCHAR(20) NOT NULL,
        "base_currency"       VARCHAR(10) NOT NULL,
        "quote_currency"      VARCHAR(10) NOT NULL,
        "price_precision"     INTEGER NOT NULL DEFAULT 8,
        "quantity_precision"  INTEGER NOT NULL DEFAULT 8,
        "min_quantity"        DECIMAL(36,18) NOT NULL DEFAULT 0.00000001,
        "maker_fee"           DECIMAL(36,18) NOT NULL DEFAULT 0.001,
        "taker_fee"           DECIMAL(36,18) NOT NULL DEFAULT 0.001,
        "is_active"           BOOLEAN NOT NULL DEFAULT true,
        "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "UQ_trading_pairs_symbol" UNIQUE ("symbol")
      );
    `);

    // ── Orders ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"          UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "symbol"           VARCHAR(20) NOT NULL,
        "side"             order_side_enum NOT NULL,
        "type"             order_type_enum NOT NULL,
        "status"           order_status_enum NOT NULL DEFAULT 'open',
        "price"            DECIMAL(36,18) NOT NULL,
        "quantity"         DECIMAL(36,18) NOT NULL,
        "filled_quantity"  DECIMAL(36,18) NOT NULL DEFAULT 0,
        "filled_quote"     DECIMAL(36,18) NOT NULL DEFAULT 0,
        "base_currency"    VARCHAR(10) NOT NULL,
        "quote_currency"   VARCHAR(10) NOT NULL,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_orders_symbol" ON "orders" ("symbol")`);
    await queryRunner.query(`CREATE INDEX "IDX_orders_user_status" ON "orders" ("user_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_orders_symbol_status_side" ON "orders" ("symbol", "status", "side")`);

    // ── Trades ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "trades" (
        "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "symbol"          VARCHAR(20) NOT NULL,
        "price"           DECIMAL(36,18) NOT NULL,
        "quantity"        DECIMAL(36,18) NOT NULL,
        "quote_quantity"  DECIMAL(36,18) NOT NULL,
        "maker_order_id"  UUID NOT NULL,
        "taker_order_id"  UUID NOT NULL,
        "maker_user_id"   UUID NOT NULL,
        "taker_user_id"   UUID NOT NULL,
        "taker_side"      VARCHAR(4) NOT NULL,
        "maker_fee"       DECIMAL(36,18) NOT NULL DEFAULT 0,
        "taker_fee"       DECIMAL(36,18) NOT NULL DEFAULT 0,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_trades_symbol_time" ON "trades" ("symbol", "created_at")`);

    // ── Audit Logs ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"       UUID,
        "action"        VARCHAR(100) NOT NULL,
        "resource_type" VARCHAR(50),
        "resource_id"   UUID,
        "metadata"      JSONB,
        "ip_address"    VARCHAR(45),
        "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_audit_user_time" ON "audit_logs" ("user_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_action_time" ON "audit_logs" ("action", "created_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "trades" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "trading_pairs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wallets" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "order_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "order_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "order_side_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "kyc_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum"`);
  }
}
