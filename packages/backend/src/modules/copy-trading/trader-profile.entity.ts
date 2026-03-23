import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('trader_profiles')
export class TraderProfile extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'display_name', type: 'varchar', length: 100 })
  displayName: string;

  @Column({ type: 'text', default: '' })
  bio: string;

  @Column({ name: 'total_followers', type: 'int', default: 0 })
  totalFollowers: number;

  @Column({ name: 'total_copiers', type: 'int', default: 0 })
  totalCopiers: number;

  @Column({
    name: 'win_rate',
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: '0',
  })
  winRate: string;

  @Column({
    name: 'total_pnl',
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
  })
  totalPnl: string;

  @Column({
    name: 'avg_return_percent',
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: '0',
  })
  avgReturnPercent: string;

  @Column({ name: 'is_public', type: 'boolean', default: true })
  isPublic: boolean;
}
