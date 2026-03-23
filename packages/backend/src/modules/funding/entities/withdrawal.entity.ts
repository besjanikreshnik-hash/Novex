import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum WithdrawalStatus {
  PENDING = 'pending',
  HOLD = 'hold',
  APPROVED = 'approved',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  FAILED = 'failed',
}

@Entity('withdrawals')
@Index(['userId', 'createdAt'])
@Index(['status'])
export class Withdrawal extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 10 })
  asset: string;

  @Column({ type: 'varchar', length: 20 })
  network: string;

  @Column({ type: 'varchar', length: 200 })
  address: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  memo: string | null;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  amount: string;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  fee: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'tx_hash' })
  txHash: string | null;

  @Column({ type: 'enum', enum: WithdrawalStatus, default: WithdrawalStatus.PENDING })
  status: WithdrawalStatus;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true, name: 'risk_score' })
  riskScore: string | null;

  /** Admin who approved/rejected */
  @Column({ type: 'uuid', nullable: true, name: 'reviewed_by' })
  reviewedBy: string | null;

  @Column({ type: 'text', nullable: true, name: 'review_note' })
  reviewNote: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'reviewed_at' })
  reviewedAt: Date | null;

  /** Admin who executed/processed the withdrawal (must differ from reviewedBy for maker-checker) */
  @Column({ type: 'uuid', nullable: true, name: 'processed_by' })
  processedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'processed_at' })
  processedAt: Date | null;

  /** If true, address was first seen for this user — 24h hold applies */
  @Column({ type: 'boolean', default: false, name: 'is_new_address' })
  isNewAddress: boolean;

  /** When the hold period expires (for new addresses) */
  @Column({ type: 'timestamptz', nullable: true, name: 'hold_until' })
  holdUntil: Date | null;
}
