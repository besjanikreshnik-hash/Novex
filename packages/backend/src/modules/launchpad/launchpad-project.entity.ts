import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export type LaunchpadProjectStatus =
  | 'upcoming'
  | 'active'
  | 'completed'
  | 'cancelled';

@Entity('launchpad_projects')
export class LaunchpadProject extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'token_symbol', type: 'varchar', length: 20 })
  tokenSymbol: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({
    name: 'total_supply',
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
  })
  totalSupply: string;

  @Column({
    name: 'price_per_token',
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
  })
  pricePerToken: string;

  @Column({
    name: 'hard_cap',
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
  })
  hardCap: string;

  @Column({
    name: 'soft_cap',
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
  })
  softCap: string;

  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
  })
  raised: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'upcoming',
  })
  status: LaunchpadProjectStatus;

  @Column({ name: 'start_date', type: 'timestamptz' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamptz' })
  endDate: Date;

  @Column({
    name: 'vesting_schedule',
    type: 'jsonb',
    default: '{}',
    comment: 'JSON describing token vesting milestones',
  })
  vestingSchedule: Record<string, unknown>;

  @Column({
    name: 'social_links',
    type: 'jsonb',
    default: '{}',
    comment: 'JSON with website, twitter, telegram, discord, etc.',
  })
  socialLinks: Record<string, string>;

  @Column({ name: 'logo_url', type: 'varchar', length: 500, default: '' })
  logoUrl: string;
}
