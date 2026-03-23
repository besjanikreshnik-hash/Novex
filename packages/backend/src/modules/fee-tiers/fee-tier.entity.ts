import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('fee_tiers')
@Index(['tier'], { unique: true })
export class FeeTier extends BaseEntity {
  @Column({ type: 'int' })
  tier: number;

  @Column({ type: 'varchar', length: 20 })
  name: string;

  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    name: 'min_volume_30d',
    comment: 'Minimum 30-day trading volume in USD to qualify',
  })
  minVolume30d: string;

  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    name: 'maker_fee_rate',
  })
  makerFeeRate: string;

  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    name: 'taker_fee_rate',
  })
  takerFeeRate: string;

  @Column({ type: 'jsonb', default: '{}' })
  benefits: Record<string, any>;
}
