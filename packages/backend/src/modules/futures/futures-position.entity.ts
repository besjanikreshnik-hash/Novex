import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../users/user.entity';

export enum PositionSide {
  LONG = 'long',
  SHORT = 'short',
}

export enum PositionStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  LIQUIDATED = 'liquidated',
}

@Entity('futures_positions')
@Index(['userId', 'status'])
@Index(['symbol', 'status'])
export class FuturesPosition extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'enum', enum: PositionSide })
  side: PositionSide;

  @Column({ type: 'int' })
  leverage: number;

  @Column({
    name: 'entry_price',
    type: 'decimal',
    precision: 36,
    scale: 18,
  })
  entryPrice: string;

  @Column({
    name: 'mark_price',
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
  })
  markPrice: string;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  quantity: string;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  margin: string;

  @Column({
    name: 'unrealized_pnl',
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
  })
  unrealizedPnl: string;

  @Column({
    name: 'realized_pnl',
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
  })
  realizedPnl: string;

  @Column({
    name: 'liquidation_price',
    type: 'decimal',
    precision: 36,
    scale: 18,
  })
  liquidationPrice: string;

  @Column({
    type: 'enum',
    enum: PositionStatus,
    default: PositionStatus.OPEN,
  })
  status: PositionStatus;

  @Column({
    name: 'stop_loss',
    type: 'decimal',
    precision: 36,
    scale: 18,
    nullable: true,
  })
  stopLoss: string | null;

  @Column({
    name: 'take_profit',
    type: 'decimal',
    precision: 36,
    scale: 18,
    nullable: true,
  })
  takeProfit: string | null;

  @Column({
    name: 'closed_at',
    type: 'timestamptz',
    nullable: true,
  })
  closedAt: Date | null;
}
