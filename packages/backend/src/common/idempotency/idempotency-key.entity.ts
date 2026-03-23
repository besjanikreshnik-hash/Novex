import { Entity, Column, Index, PrimaryColumn } from 'typeorm';

/**
 * IdempotencyKey — Stores completed operation results to prevent duplicate processing.
 *
 * The key is a client-supplied string (UUID recommended). If a request arrives
 * with a key that already exists and has status='completed', we return the
 * cached response instead of re-executing the operation.
 *
 * Keys expire after 24 hours. A background job should clean expired rows.
 */
@Entity('idempotency_keys')
export class IdempotencyKey {
  /** Client-supplied idempotency key */
  @PrimaryColumn({ type: 'varchar', length: 64 })
  key: string;

  @Column({ type: 'uuid', name: 'user_id' })
  @Index()
  userId: string;

  /** 'processing' while in flight, 'completed' when done */
  @Column({ type: 'varchar', length: 20, default: 'processing' })
  status: 'processing' | 'completed';

  /** The operation type: 'place_order', 'cancel_order' */
  @Column({ type: 'varchar', length: 30 })
  operation: string;

  /** SHA-256 hex digest of the canonical request payload. Used to reject
   *  reuse of the same key with a different payload. */
  @Column({ type: 'varchar', length: 64, name: 'request_hash' })
  requestHash: string;

  /** JSON-serialized response body (cached for replay) */
  @Column({ type: 'jsonb', nullable: true, name: 'response_body' })
  responseBody: Record<string, any> | null;

  /** HTTP status code of the original response */
  @Column({ type: 'int', nullable: true, name: 'response_status' })
  responseStatus: number | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;
}
