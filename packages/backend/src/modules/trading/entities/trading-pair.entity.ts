import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('trading_pairs')
export class TradingPair extends BaseEntity {
  @Column({ type: 'varchar', length: 20 })
  @Index({ unique: true })
  symbol: string; // e.g. "BTC_USDT"

  @Column({ type: 'varchar', length: 10 })
  baseCurrency: string; // e.g. "BTC"

  @Column({ type: 'varchar', length: 10 })
  quoteCurrency: string; // e.g. "USDT"

  @Column({ type: 'int', default: 8, comment: 'Decimal places for price' })
  pricePrecision: number;

  @Column({ type: 'int', default: 8, comment: 'Decimal places for quantity' })
  quantityPrecision: number;

  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0.00000001',
    comment: 'Minimum order quantity',
  })
  minQuantity: string;

  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0.01',
    comment: 'Maker fee rate (e.g. 0.001 = 0.1%)',
  })
  makerFee: string;

  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0.01',
    comment: 'Taker fee rate',
  })
  takerFee: string;

  /** Maximum order quantity (0 = unlimited) */
  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
    name: 'max_quantity',
  })
  maxQuantity: string;

  /** Minimum order notional value in quote (e.g. 10 USDT) */
  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '10',
    name: 'min_notional',
  })
  minNotional: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /**
   * Self-Trade Prevention mode.
   *   'cancel_taker' — reject the incoming taker order for the self-crossing portion
   *   'cancel_maker' — remove the resting maker order instead
   *   'none'         — allow self-trades (testing only)
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: 'cancel_taker',
    name: 'stp_mode',
  })
  stpMode: 'cancel_taker' | 'cancel_maker' | 'none';
}
