import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('p2p_listings')
@Index(['type', 'asset', 'fiatCurrency', 'status'])
export class P2pListing extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 4 })
  type: 'buy' | 'sell';

  @Column({ type: 'varchar', length: 20 })
  asset: string;

  @Column({ type: 'varchar', length: 10, name: 'fiat_currency' })
  fiatCurrency: string;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  price: string;

  @Column({ type: 'decimal', precision: 36, scale: 18, name: 'min_amount' })
  minAmount: string;

  @Column({ type: 'decimal', precision: 36, scale: 18, name: 'max_amount' })
  maxAmount: string;

  @Column({ type: 'jsonb', name: 'payment_methods', default: '[]' })
  paymentMethods: string[];

  @Column({
    type: 'varchar',
    length: 20,
    default: 'active',
  })
  status: 'active' | 'completed' | 'cancelled';

  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    name: 'total_amount',
  })
  totalAmount: string;

  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    name: 'filled_amount',
    default: '0',
  })
  filledAmount: string;
}
