import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ReconciliationRun } from './reconciliation-run.entity';

export enum MismatchType {
  /** Wallet has negative available balance */
  NEGATIVE_AVAILABLE = 'negative_available',
  /** Wallet has negative locked balance */
  NEGATIVE_LOCKED = 'negative_locked',
  /** fee_ledger total for an asset ≠ treasury wallet balance for that asset */
  FEE_LEDGER_TREASURY_MISMATCH = 'fee_ledger_treasury_mismatch',
  /** A trade is missing an expected fee_ledger entry */
  MISSING_FEE_LEDGER_ENTRY = 'missing_fee_ledger_entry',
  /** An order's filledQuantity > quantity */
  ORDER_OVERFILL = 'order_overfill',
  /** Trade gross_quote ≠ price × gross_base (within tolerance) */
  TRADE_QUOTE_MISMATCH = 'trade_quote_mismatch',
  /** Sum of trade settlements for an asset doesn't match wallet delta */
  SETTLEMENT_BALANCE_DRIFT = 'settlement_balance_drift',
}

/**
 * ReconciliationMismatch — A single invariant violation found during a run.
 *
 * Stores the expected value, actual value, and references to the offending
 * entities so operators can investigate.
 */
@Entity('reconciliation_mismatches')
@Index(['runId'])
@Index(['mismatchType'])
export class ReconciliationMismatch extends BaseEntity {
  @Column({ type: 'uuid', name: 'run_id' })
  runId: string;

  @ManyToOne(() => ReconciliationRun, (r) => r.mismatches, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'run_id' })
  run: ReconciliationRun;

  @Column({ type: 'enum', enum: MismatchType, name: 'mismatch_type' })
  mismatchType: MismatchType;

  /** Asset involved (e.g. "BTC", "USDT") */
  @Column({ type: 'varchar', length: 10 })
  asset: string;

  /** Human-readable description of what was checked */
  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 100, name: 'expected_value' })
  expectedValue: string;

  @Column({ type: 'varchar', length: 100, name: 'actual_value' })
  actualValue: string;

  /** Absolute difference between expected and actual */
  @Column({ type: 'varchar', length: 100, name: 'difference' })
  difference: string;

  /** Optional reference to a specific entity (wallet ID, trade ID, order ID) */
  @Column({ type: 'uuid', nullable: true, name: 'reference_id' })
  referenceId: string | null;

  /** Type of the referenced entity (e.g. "wallet", "trade", "order") */
  @Column({ type: 'varchar', length: 30, nullable: true, name: 'reference_type' })
  referenceType: string | null;
}
