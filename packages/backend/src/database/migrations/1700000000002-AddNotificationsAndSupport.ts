import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NovEx — Notifications, Price Alerts, and Support Tickets
 *
 * Phase 1 tables for notifications infrastructure and support center.
 */
export class AddNotificationsAndSupport1700000000002 implements MigrationInterface {
  name = 'AddNotificationsAndSupport1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Notifications ───────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"     UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "type"        VARCHAR(30) NOT NULL,
        "title"       VARCHAR(200) NOT NULL,
        "body"        TEXT,
        "data"        JSONB,
        "is_read"     BOOLEAN NOT NULL DEFAULT false,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_notif_user_time" ON "notifications" ("user_id", "created_at" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_notif_unread" ON "notifications" ("user_id") WHERE "is_read" = false`);

    // ── Price Alerts ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "price_alerts" (
        "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"       UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "pair_symbol"   VARCHAR(20) NOT NULL,
        "condition"     VARCHAR(5) NOT NULL,
        "target_price"  DECIMAL(36,18) NOT NULL,
        "is_active"     BOOLEAN NOT NULL DEFAULT true,
        "triggered_at"  TIMESTAMPTZ,
        "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_alerts_active" ON "price_alerts" ("pair_symbol") WHERE "is_active" = true`);

    // ── Deposits ────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "deposits" (
        "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"           UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "asset"             VARCHAR(10) NOT NULL,
        "network"           VARCHAR(20) NOT NULL,
        "tx_hash"           VARCHAR(100) NOT NULL,
        "address"           VARCHAR(200) NOT NULL,
        "amount"            DECIMAL(36,18) NOT NULL,
        "confirmations"     SMALLINT NOT NULL DEFAULT 0,
        "required_confs"    SMALLINT NOT NULL,
        "status"            VARCHAR(20) NOT NULL DEFAULT 'pending',
        "credited_at"       TIMESTAMPTZ,
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_deposits_user" ON "deposits" ("user_id", "created_at" DESC)`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_deposits_tx" ON "deposits" ("tx_hash", "network")`);

    // ── Withdrawals ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "withdrawals" (
        "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"      UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "asset"        VARCHAR(10) NOT NULL,
        "network"      VARCHAR(20) NOT NULL,
        "address"      VARCHAR(200) NOT NULL,
        "memo"         VARCHAR(100),
        "amount"       DECIMAL(36,18) NOT NULL,
        "fee"          DECIMAL(36,18) NOT NULL,
        "tx_hash"      VARCHAR(100),
        "status"       VARCHAR(20) NOT NULL DEFAULT 'pending',
        "risk_score"   DECIMAL(3,2),
        "approved_by"  UUID REFERENCES "users"("id"),
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_withdrawals_user" ON "withdrawals" ("user_id", "created_at" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_withdrawals_pending" ON "withdrawals" ("status") WHERE "status" IN ('pending', 'approved')`);

    // ── Support Tickets ─────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "support_tickets" (
        "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"      UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "subject"      VARCHAR(200) NOT NULL,
        "category"     VARCHAR(30) NOT NULL,
        "status"       VARCHAR(20) NOT NULL DEFAULT 'open',
        "priority"     VARCHAR(10) NOT NULL DEFAULT 'medium',
        "assigned_to"  UUID REFERENCES "users"("id"),
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ── Announcements ───────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "announcements" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "title"       VARCHAR(200) NOT NULL,
        "body"        TEXT NOT NULL,
        "type"        VARCHAR(20) NOT NULL DEFAULT 'info',
        "is_active"   BOOLEAN NOT NULL DEFAULT true,
        "starts_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "ends_at"     TIMESTAMPTZ,
        "created_by"  UUID REFERENCES "users"("id"),
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ── API Keys ────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "api_keys" (
        "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"      UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "label"        VARCHAR(100) NOT NULL,
        "key_prefix"   VARCHAR(8) NOT NULL,
        "key_hash"     VARCHAR(64) NOT NULL UNIQUE,
        "secret_enc"   TEXT NOT NULL,
        "permissions"  TEXT[] NOT NULL DEFAULT '{}',
        "ip_whitelist" TEXT[],
        "is_active"    BOOLEAN NOT NULL DEFAULT true,
        "last_used_at" TIMESTAMPTZ,
        "expires_at"   TIMESTAMPTZ,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_api_keys_user" ON "api_keys" ("user_id") WHERE "is_active" = true`);

    // ── Referral Rewards ────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "referral_rewards" (
        "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "referrer_id"  UUID NOT NULL REFERENCES "users"("id"),
        "referee_id"   UUID NOT NULL REFERENCES "users"("id"),
        "trade_id"     UUID,
        "commission"   DECIMAL(36,18) NOT NULL,
        "asset"        VARCHAR(10) NOT NULL,
        "status"       VARCHAR(20) NOT NULL DEFAULT 'pending',
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ── System Config ───────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "system_config" (
        "key"          VARCHAR(100) PRIMARY KEY,
        "value"        JSONB NOT NULL,
        "description"  TEXT,
        "updated_by"   UUID REFERENCES "users"("id"),
        "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'system_config', 'referral_rewards', 'api_keys', 'announcements',
      'support_tickets', 'withdrawals', 'deposits', 'price_alerts', 'notifications',
    ];
    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }
  }
}
