import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * FeeLedger — Immutable record of fees collected by the platform.
 *
 * Each trade produces 0–2 fee ledger entries (one per party charged).
 * This provides a complete, auditable trail of platform revenue.
 */
@Entity('fee_ledger')
@Index(['asset', 'createdAt'])
@Index(['tradeId'])
export class FeeLedger extends BaseEntity {
  @Column({ type: 'uuid', name: 'trade_id' })
  tradeId: string;

  /** Asset in which fee was collected (e.g. BTC, USDT) */
  @Column({ type: 'varchar', length: 10 })
  asset: string;

  /** Fee amount (always positive) */
  @Column({ type: 'decimal', precision: 36, scale: 18 })
  amount: string;

  /** 'buyer_fee' or 'seller_fee' — who paid */
  @Column({ type: 'varchar', length: 20 })
  source: string;

  /** User who was charged */
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;
}
