import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum ReferralStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  REWARDED = 'rewarded',
}

@Entity('referrals')
@Index(['referrerId'])
@Index(['referredId'], { unique: true })
@Index(['referralCode'])
export class Referral extends BaseEntity {
  @Column({ type: 'uuid', name: 'referrer_id' })
  referrerId: string;

  @Column({ type: 'uuid', name: 'referred_id' })
  referredId: string;

  @Column({ type: 'varchar', length: 8, name: 'referral_code' })
  referralCode: string;

  @Column({
    type: 'enum',
    enum: ReferralStatus,
    default: ReferralStatus.PENDING,
  })
  status: ReferralStatus;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 8,
    default: 0,
    name: 'reward_amount',
  })
  rewardAmount: string;

  @Column({
    type: 'varchar',
    length: 10,
    default: 'USDT',
    name: 'reward_currency',
  })
  rewardCurrency: string;
}
