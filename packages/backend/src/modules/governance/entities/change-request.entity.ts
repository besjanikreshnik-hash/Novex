import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum ChangeRequestType {
  PAIR_HALT = 'pair_halt',
  PAIR_UNHALT = 'pair_unhalt',
  FEE_CHANGE = 'fee_change',
  SYSTEM_CONFIG = 'system_config',
  WITHDRAWAL_LIMIT_CHANGE = 'withdrawal_limit_change',
  KYC_MANUAL_OVERRIDE = 'kyc_manual_override',
}

export enum ChangeRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXECUTED = 'executed',
  EXPIRED = 'expired',
}

/**
 * ChangeRequest — maker-checker governance record.
 *
 * Any sensitive admin action requires:
 *   1. Proposer creates a change request (maker)
 *   2. Approver reviews and approves (checker) — must be a different admin
 *   3. System executes the change after approval
 *
 * Emergency actions can bypass maker-checker with a flag + mandatory post-review.
 */
@Entity('change_requests')
@Index(['status'])
@Index(['type'])
export class ChangeRequest extends BaseEntity {
  @Column({ type: 'varchar', length: 30 })
  type: ChangeRequestType;

  @Column({ type: 'varchar', length: 20 })
  status: ChangeRequestStatus;

  /** The admin who proposed this change */
  @Column({ type: 'uuid', name: 'proposed_by' })
  proposedBy: string;

  @Column({ type: 'text' })
  description: string;

  /** The change payload — what to change and to what values */
  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  /** The state BEFORE the change (for rollback) */
  @Column({ type: 'jsonb', nullable: true, name: 'previous_state' })
  previousState: Record<string, any> | null;

  /** The admin who approved (must differ from proposedBy) */
  @Column({ type: 'uuid', nullable: true, name: 'approved_by' })
  approvedBy: string | null;

  @Column({ type: 'text', nullable: true, name: 'approval_note' })
  approvalNote: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'approved_at' })
  approvedAt: Date | null;

  /** The admin who rejected */
  @Column({ type: 'uuid', nullable: true, name: 'rejected_by' })
  rejectedBy: string | null;

  @Column({ type: 'text', nullable: true, name: 'rejection_note' })
  rejectionNote: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'executed_at' })
  executedAt: Date | null;

  /** True if this was an emergency bypass of maker-checker */
  @Column({ type: 'boolean', default: false, name: 'is_emergency' })
  isEmergency: boolean;

  /** Change requests expire after this time (24h default) */
  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;
}
