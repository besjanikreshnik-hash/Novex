import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('p2p_orders')
@Index(['listingId'])
@Index(['buyerId'])
@Index(['sellerId'])
export class P2pOrder extends BaseEntity {
  @Column({ type: 'uuid', name: 'listing_id' })
  listingId: string;

  @Column({ type: 'uuid', name: 'buyer_id' })
  buyerId: string;

  @Column({ type: 'uuid', name: 'seller_id' })
  sellerId: string;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  amount: string;

  @Column({ type: 'decimal', precision: 36, scale: 18, name: 'fiat_amount' })
  fiatAmount: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status: 'pending' | 'paid' | 'released' | 'disputed' | 'cancelled';

  @Column({ type: 'jsonb', name: 'chat_messages', default: '[]' })
  chatMessages: { sender: string; message: string; timestamp: string }[];

  @Column({ type: 'timestamptz', name: 'paid_at', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'timestamptz', name: 'released_at', nullable: true })
  releasedAt: Date | null;
}
