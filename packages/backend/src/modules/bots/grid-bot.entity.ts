import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export type GridBotStatus = 'running' | 'paused' | 'stopped';
export type GridType = 'arithmetic' | 'geometric';

export interface GridOrder {
  level: number;
  price: string;
  side: 'buy' | 'sell';
  orderId: string | null;
  status: 'pending' | 'placed' | 'filled' | 'cancelled';
}

@Entity('grid_bots')
export class GridBot extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'varchar', length: 20, default: 'running' })
  status: GridBotStatus;

  @Column({ name: 'grid_type', type: 'varchar', length: 20, default: 'arithmetic' })
  gridType: GridType;

  @Column({
    name: 'lower_price',
    type: 'decimal',
    precision: 36,
    scale: 18,
  })
  lowerPrice: string;

  @Column({
    name: 'upper_price',
    type: 'decimal',
    precision: 36,
    scale: 18,
  })
  upperPrice: string;

  @Column({ name: 'grid_count', type: 'int' })
  gridCount: number;

  @Column({
    name: 'total_investment',
    type: 'decimal',
    precision: 36,
    scale: 18,
  })
  totalInvestment: string;

  @Column({
    name: 'profit_per_grid',
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
  })
  profitPerGrid: string;

  @Column({
    name: 'total_profit',
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
  })
  totalProfit: string;

  @Column({ name: 'grid_orders', type: 'jsonb', default: '[]' })
  gridOrders: GridOrder[];
}
