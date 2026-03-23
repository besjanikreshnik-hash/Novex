import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export type AlertDirection = 'above' | 'below';
export type AlertStatus = 'active' | 'triggered' | 'cancelled';

@Entity('price_alerts')
@Index(['userId', 'status'])
@Index(['symbol', 'status'])
export class PriceAlert extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'decimal', precision: 24, scale: 8, name: 'target_price' })
  targetPrice: string;

  @Column({ type: 'varchar', length: 10 })
  direction: AlertDirection;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: AlertStatus;

  @Column({ type: 'timestamptz', nullable: true, name: 'triggered_at' })
  triggeredAt: Date | null;
}
