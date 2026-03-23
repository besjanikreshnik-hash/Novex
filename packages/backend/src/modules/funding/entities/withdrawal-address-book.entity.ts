import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * Tracks known withdrawal addresses per user.
 * First-time addresses trigger a 24h hold on the withdrawal.
 */
@Entity('withdrawal_address_book')
@Index(['userId', 'asset', 'network', 'address'], { unique: true })
export class WithdrawalAddressBook extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 10 })
  asset: string;

  @Column({ type: 'varchar', length: 20 })
  network: string;

  @Column({ type: 'varchar', length: 200 })
  address: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  label: string | null;

  @Column({ type: 'timestamptz', name: 'first_used_at', default: () => 'NOW()' })
  firstUsedAt: Date;
}
