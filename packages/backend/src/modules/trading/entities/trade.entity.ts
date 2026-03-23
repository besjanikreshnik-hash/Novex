import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * Trade — Immutable record of a matched execution.
 *
 * Fee model: each party is charged a fee in the asset they *receive*.
 *   - Buyer  receives base  → buyer fee is in base  → net_base  = gross_base  − buyer_fee
 *   - Seller receives quote → seller fee is in quote → net_quote = gross_quote − seller_fee
 *
 * This guarantees fees are never subtracted cross-asset.
 * Fees are credited to the platform treasury wallet (PLATFORM_FEE_ACCOUNT).
 */
@Entity('trades')
@Index(['symbol', 'createdAt'])
export class Trade extends BaseEntity {
  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  price: string;

  /* ─── Gross amounts (before fees) ───────────────────── */

  /** Base asset quantity traded (= gross_base) */
  @Column({ type: 'decimal', precision: 36, scale: 18, name: 'gross_base' })
  grossBase: string;

  /** Quote asset quantity traded (= price × gross_base) */
  @Column({ type: 'decimal', precision: 36, scale: 18, name: 'gross_quote' })
  grossQuote: string;

  /* ─── Buyer (receives base, pays quote) ─────────────── */

  @Column({ type: 'decimal', precision: 36, scale: 18, name: 'buyer_fee_amount', default: '0' })
  buyerFeeAmount: string;

  @Column({ type: 'varchar', length: 10, name: 'buyer_fee_asset' })
  buyerFeeAsset: string;

  /* ─── Seller (receives quote, pays base) ────────────── */

  @Column({ type: 'decimal', precision: 36, scale: 18, name: 'seller_fee_amount', default: '0' })
  sellerFeeAmount: string;

  @Column({ type: 'varchar', length: 10, name: 'seller_fee_asset' })
  sellerFeeAsset: string;

  /* ─── Fee rates snapshotted at execution time ───────── */

  @Column({ type: 'decimal', precision: 36, scale: 18, name: 'maker_fee_rate' })
  makerFeeRate: string;

  @Column({ type: 'decimal', precision: 36, scale: 18, name: 'taker_fee_rate' })
  takerFeeRate: string;

  /* ─── Participants ──────────────────────────────────── */

  @Column({ type: 'uuid', name: 'maker_order_id' })
  makerOrderId: string;

  @Column({ type: 'uuid', name: 'taker_order_id' })
  takerOrderId: string;

  @Column({ type: 'uuid', name: 'maker_user_id' })
  makerUserId: string;

  @Column({ type: 'uuid', name: 'taker_user_id' })
  takerUserId: string;

  @Column({ type: 'uuid', name: 'buyer_user_id' })
  buyerUserId: string;

  @Column({ type: 'uuid', name: 'seller_user_id' })
  sellerUserId: string;

  @Column({
    type: 'varchar',
    length: 4,
    comment: 'buy or sell — side of the taker',
  })
  takerSide: string;

  /* ─── Legacy compatibility columns (kept for migration ease) ── */
  // Removed: makerFee, takerFee, quantity, quoteQuantity
  // Use grossBase, grossQuote, buyerFeeAmount, sellerFeeAmount instead
}
