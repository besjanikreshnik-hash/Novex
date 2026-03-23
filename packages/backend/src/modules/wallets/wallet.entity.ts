import { Entity, Column, ManyToOne, JoinColumn, Index, VersionColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../users/user.entity';

@Entity('wallets')
@Index(['userId', 'currency'], { unique: true })
export class Wallet extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.wallets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 20 })
  currency: string;

  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
    comment: 'Funds available for trading / withdrawal',
  })
  available: string;

  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
    comment: 'Funds locked in open orders',
  })
  locked: string;

  @VersionColumn()
  version: number;
}
