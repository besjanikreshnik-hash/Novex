import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ReconciliationMismatch } from './reconciliation-mismatch.entity';

export enum ReconciliationStatus {
  RUNNING = 'running',
  PASSED = 'passed',
  FAILED = 'failed',
  ERROR = 'error',
}

/**
 * ReconciliationRun — A single execution of the reconciliation sweep.
 *
 * Each run checks all invariants across all assets and produces zero or
 * more mismatch records. A run with zero mismatches has status PASSED.
 */
@Entity('reconciliation_runs')
export class ReconciliationRun extends BaseEntity {
  @Column({
    type: 'enum',
    enum: ReconciliationStatus,
    default: ReconciliationStatus.RUNNING,
  })
  status: ReconciliationStatus;

  @Column({ type: 'timestamptz', nullable: true, name: 'finished_at' })
  finishedAt: Date | null;

  /** Comma-separated list of assets checked (e.g. "BTC,USDT,ETH") */
  @Column({ type: 'varchar', length: 500, name: 'assets_checked' })
  assetsChecked: string;

  /** Total number of mismatches found */
  @Column({ type: 'int', default: 0, name: 'mismatch_count' })
  mismatchCount: number;

  /** Total number of invariant checks executed */
  @Column({ type: 'int', default: 0, name: 'checks_executed' })
  checksExecuted: number;

  /** Who or what triggered the run: 'admin', 'scheduler', 'api' */
  @Column({ type: 'varchar', length: 20, default: 'api' })
  trigger: string;

  /** Optional error message if status = ERROR */
  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string | null;

  @OneToMany(() => ReconciliationMismatch, (m) => m.run)
  mismatches: ReconciliationMismatch[];
}
