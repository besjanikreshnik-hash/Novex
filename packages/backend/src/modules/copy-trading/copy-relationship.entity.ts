import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export type CopyStatus = 'active' | 'paused' | 'stopped';

@Entity('copy_relationships')
export class CopyRelationship extends BaseEntity {
  @Column({ name: 'copier_id', type: 'uuid' })
  copierId: string;

  @Column({ name: 'trader_id', type: 'uuid' })
  traderId: string;

  @Column({
    name: 'allocation_amount',
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
  })
  allocationAmount: string;

  @Column({
    name: 'max_position_size',
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
  })
  maxPositionSize: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: CopyStatus;

  @Column({ name: 'total_copied_trades', type: 'int', default: 0 })
  totalCopiedTrades: number;

  @Column({
    name: 'total_pnl',
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
  })
  totalPnl: string;
}
