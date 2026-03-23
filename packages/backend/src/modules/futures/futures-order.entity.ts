import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../users/user.entity';

export enum FuturesOrderSide {
  BUY = 'buy',
  SELL = 'sell',
}

export enum FuturesOrderType {
  LIMIT = 'limit',
  MARKET = 'market',
}

export enum FuturesPositionSide {
  LONG = 'long',
  SHORT = 'short',
}

export enum FuturesOrderStatus {
  OPEN = 'open',
  FILLED = 'filled',
  CANCELLED = 'cancelled',
}

@Entity('futures_orders')
@Index(['userId', 'status'])
@Index(['symbol', 'status'])
export class FuturesOrder extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'enum', enum: FuturesOrderSide })
  side: FuturesOrderSide;

  @Column({ type: 'enum', enum: FuturesOrderType })
  type: FuturesOrderType;

  @Column({
    name: 'position_side',
    type: 'enum',
    enum: FuturesPositionSide,
  })
  positionSide: FuturesPositionSide;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  price: string;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  quantity: string;

  @Column({ type: 'int' })
  leverage: number;

  @Column({
    type: 'enum',
    enum: FuturesOrderStatus,
    default: FuturesOrderStatus.OPEN,
  })
  status: FuturesOrderStatus;

  @Column({ name: 'reduce_only', type: 'boolean', default: false })
  reduceOnly: boolean;
}
