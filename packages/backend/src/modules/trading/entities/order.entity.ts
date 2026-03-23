import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/user.entity';

export enum OrderSide {
  BUY = 'buy',
  SELL = 'sell',
}

export enum OrderType {
  LIMIT = 'limit',
  MARKET = 'market',
  STOP_LIMIT = 'stop_limit',
  OCO = 'oco',
  TRAILING_STOP = 'trailing_stop',
}

export enum OrderStatus {
  OPEN = 'open',
  PARTIALLY_FILLED = 'partially_filled',
  FILLED = 'filled',
  CANCELLED = 'cancelled',
  TRIGGERED = 'triggered',
}

@Entity('orders')
@Index(['userId', 'status'])
@Index(['symbol', 'status', 'side'])
export class Order extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  symbol: string;

  @Column({ type: 'enum', enum: OrderSide })
  side: OrderSide;

  @Column({ type: 'enum', enum: OrderType })
  type: OrderType;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.OPEN })
  status: OrderStatus;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  price: string;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  quantity: string;

  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
    comment: 'Quantity already filled',
  })
  filledQuantity: string;

  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
    comment: 'Cumulative quote amount filled',
  })
  filledQuote: string;

  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    nullable: true,
    comment: 'Trigger price for stop-limit orders',
  })
  stopPrice: string | null;

  @Column({
    name: 'oco_group_id',
    type: 'uuid',
    nullable: true,
    comment: 'Links two OCO orders together',
  })
  @Index()
  ocoGroupId: string | null;

  @Column({
    name: 'trailing_delta',
    type: 'decimal',
    precision: 36,
    scale: 18,
    nullable: true,
    comment: 'Trailing distance in price units',
  })
  trailingDelta: string | null;

  @Column({
    name: 'trailing_activation_price',
    type: 'decimal',
    precision: 36,
    scale: 18,
    nullable: true,
    comment: 'Price at which trailing stop becomes active',
  })
  trailingActivationPrice: string | null;

  @Column({ type: 'varchar', length: 10 })
  baseCurrency: string;

  @Column({ type: 'varchar', length: 10 })
  quoteCurrency: string;
}
