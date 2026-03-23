import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export type StakingProductStatus = 'active' | 'paused' | 'closed';

@Entity('staking_products')
export class StakingProduct extends BaseEntity {
  @Column({ type: 'varchar', length: 20 })
  asset: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({
    name: 'annual_rate',
    type: 'decimal',
    precision: 10,
    scale: 4,
    comment: 'Annual percentage yield as a decimal (e.g. 2.5 for 2.5%)',
  })
  annualRate: string;

  @Column({
    name: 'min_amount',
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
  })
  minAmount: string;

  @Column({
    name: 'max_amount',
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
    comment: '0 = no maximum',
  })
  maxAmount: string;

  @Column({
    name: 'lock_days',
    type: 'int',
    default: 0,
    comment: '0 = flexible (no lock)',
  })
  lockDays: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'active',
  })
  status: StakingProductStatus;

  @Column({
    name: 'total_staked',
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
  })
  totalStaked: string;

  @Column({
    name: 'max_capacity',
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
    comment: '0 = unlimited capacity',
  })
  maxCapacity: string;
}
