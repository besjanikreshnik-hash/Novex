import { MigrationInterface, QueryRunner } from 'typeorm';

export class GovernanceAndRoles1700000000009 implements MigrationInterface {
  name = 'GovernanceAndRoles1700000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Expand user role enum
    await queryRunner.query(`ALTER TYPE "user_role_enum" ADD VALUE IF NOT EXISTS 'support'`);
    await queryRunner.query(`ALTER TYPE "user_role_enum" ADD VALUE IF NOT EXISTS 'compliance'`);
    await queryRunner.query(`ALTER TYPE "user_role_enum" ADD VALUE IF NOT EXISTS 'ops'`);
    await queryRunner.query(`ALTER TYPE "user_role_enum" ADD VALUE IF NOT EXISTS 'treasury'`);

    // Change request enums
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "change_request_type_enum" AS ENUM (
          'pair_halt','pair_unhalt','fee_change','system_config',
          'withdrawal_limit_change','kyc_manual_override'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "change_request_status_enum" AS ENUM (
          'pending','approved','rejected','executed','expired'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Change requests table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "change_requests" (
        "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "type"            VARCHAR(30) NOT NULL,
        "status"          VARCHAR(20) NOT NULL DEFAULT 'pending',
        "proposed_by"     UUID NOT NULL,
        "description"     TEXT NOT NULL,
        "payload"         JSONB NOT NULL,
        "previous_state"  JSONB,
        "approved_by"     UUID,
        "approval_note"   TEXT,
        "approved_at"     TIMESTAMPTZ,
        "rejected_by"     UUID,
        "rejection_note"  TEXT,
        "executed_at"     TIMESTAMPTZ,
        "is_emergency"    BOOLEAN NOT NULL DEFAULT false,
        "expires_at"      TIMESTAMPTZ NOT NULL,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_cr_status" ON "change_requests" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_cr_type" ON "change_requests" ("type")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "change_requests" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "change_request_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "change_request_type_enum"`);
  }
}
