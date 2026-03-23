import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum DepositStatus {
  PENDING = 'pending',
  CONFIRMING = 'confirming',
  CREDITED = 'credited',
  FAILED = 'failed',
}

@Entity('deposits')
@Index(['userId', 'createdAt'])
@Index(['status'])
export class Deposit extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 10 })
  asset: string;

  @Column({ type: 'varchar', length: 20 })
  network: string;

  @Column({ type: 'varchar', length: 100, name: 'tx_hash' })
  @Index({ unique: true })
  txHash: string;

  @Column({ type: 'varchar', length: 200 })
  address: string;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  amount: string;

  @Column({ type: 'smallint', default: 0 })
  confirmations: number;

  @Column({ type: 'smallint', name: 'required_confirmations' })
  requiredConfirmations: number;

  @Column({ type: 'enum', enum: DepositStatus, default: DepositStatus.PENDING })
  status: DepositStatus;

  @Column({ type: 'timestamptz', nullable: true, name: 'credited_at' })
  creditedAt: Date | null;
}
