import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../users/user.entity';
import { StakingProduct } from './staking-product.entity';

export type StakingPositionStatus = 'active' | 'completed' | 'withdrawn';

@Entity('staking_positions')
@Index(['userId'])
export class StakingPosition extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => StakingProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: StakingProduct;

  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
  })
  amount: string;

  @Column({ name: 'start_date', type: 'timestamptz' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamptz', nullable: true })
  endDate: Date | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'active',
  })
  status: StakingPositionStatus;

  @Column({
    name: 'earned_reward',
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
  })
  earnedReward: string;

  @Column({
    name: 'last_reward_at',
    type: 'timestamptz',
    nullable: true,
  })
  lastRewardAt: Date | null;
}
