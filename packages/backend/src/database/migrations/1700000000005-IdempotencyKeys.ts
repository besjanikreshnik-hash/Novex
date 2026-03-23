import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NovEx — Idempotency key table for duplicate request prevention.
 */
export class IdempotencyKeys1700000000005 implements MigrationInterface {
  name = 'IdempotencyKeys1700000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "idempotency_keys" (
        "key"              VARCHAR(64) PRIMARY KEY,
        "user_id"          UUID NOT NULL,
        "status"           VARCHAR(20) NOT NULL DEFAULT 'processing',
        "operation"        VARCHAR(30) NOT NULL,
        "request_hash"     VARCHAR(64) NOT NULL,
        "response_body"    JSONB,
        "response_status"  INTEGER,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "expires_at"       TIMESTAMPTZ NOT NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_idempotency_user" ON "idempotency_keys" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_idempotency_expires" ON "idempotency_keys" ("expires_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "idempotency_keys" CASCADE`);
  }
}
