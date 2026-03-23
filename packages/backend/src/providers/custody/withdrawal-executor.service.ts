import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Decimal from 'decimal.js';

import {
  CUSTODY_PROVIDER,
  CustodyProvider,
  CustodyTxStatus,
} from './custody-provider.interface';
import { Withdrawal, WithdrawalStatus } from '../../modules/funding/entities/withdrawal.entity';
import { WalletsService } from '../../modules/wallets/wallets.service';
import { AuditService } from '../../modules/audit/audit.service';

/**
 * Withdrawal Executor — multi-step pipeline with custody abstraction.
 *
 * Steps:
 *   1. APPROVED → create custody intent → PROCESSING
 *   2. PROCESSING → request signature → PROCESSING (signing)
 *   3. PROCESSING (signed) → broadcast → PROCESSING (broadcast)
 *   4. PROCESSING (broadcast) → confirm → COMPLETED
 *
 * Each step is idempotent. The executor can be called repeatedly
 * on the same withdrawal and it will pick up where it left off.
 *
 * Maker-checker is preserved: the operator who calls execute()
 * must differ from the operator who approved.
 */
@Injectable()
export class WithdrawalExecutorService {
  private readonly logger = new Logger(WithdrawalExecutorService.name);

  /** Track in-flight executions to prevent concurrent double-processing */
  private readonly inflight = new Set<string>();

  constructor(
    @Inject(CUSTODY_PROVIDER)
    private readonly custody: CustodyProvider,
    @InjectRepository(Withdrawal)
    private readonly withdrawalRepo: Repository<Withdrawal>,
    private readonly wallets: WalletsService,
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
    private readonly audit: AuditService,
  ) {}

  /**
   * Execute a withdrawal through the full custody pipeline.
   *
   * Idempotent: safe to call multiple times. If the withdrawal is
   * already in a terminal state (COMPLETED/REJECTED), returns immediately.
   * If mid-pipeline (PROCESSING), resumes from the last successful step.
   */
  async execute(
    withdrawalId: string,
    operatorId: string,
  ): Promise<Withdrawal> {
    // ── Double-processing guard ─────────────────────────
    if (this.inflight.has(withdrawalId)) {
      throw new BadRequestException(
        `Withdrawal ${withdrawalId} is already being processed`,
      );
    }

    const w = await this.withdrawalRepo.findOneOrFail({
      where: { id: withdrawalId },
    });

    // ── Terminal state check ────────────────────────────
    if (w.status === WithdrawalStatus.COMPLETED) return w;
    if (w.status === WithdrawalStatus.REJECTED) {
      throw new BadRequestException('Withdrawal was rejected');
    }
    if (w.status !== WithdrawalStatus.APPROVED && w.status !== WithdrawalStatus.PROCESSING) {
      throw new BadRequestException(
        `Cannot execute withdrawal in status ${w.status}`,
      );
    }

    // ── Maker-checker ───────────────────────────────────
    if (w.reviewedBy && operatorId === w.reviewedBy) {
      throw new ForbiddenException(
        'Maker-checker: the approver cannot also execute the withdrawal',
      );
    }

    this.inflight.add(withdrawalId);

    try {
      // Step 1: Transition to PROCESSING and record operator
      if (w.status === WithdrawalStatus.APPROVED) {
        w.status = WithdrawalStatus.PROCESSING;
        w.processedBy = operatorId;
        w.processedAt = new Date();
        await this.withdrawalRepo.save(w);
      }

      // Step 2: Create custody intent (idempotent)
      const intent = await this.custody.createIntent({
        intentId: withdrawalId,
        to: w.address,
        amount: w.amount,
        asset: w.asset,
        network: w.network,
        memo: w.memo ?? undefined,
        metadata: {
          userId: w.userId,
          fee: w.fee,
          approvedBy: w.reviewedBy,
          processedBy: operatorId,
        },
      });

      await this.audit.logEvent({
        userId: operatorId,
        action: 'withdrawal.custody_intent_created',
        resourceType: 'withdrawal',
        resourceId: withdrawalId,
        metadata: { providerRef: intent.providerRef, status: intent.status },
      });

      // Step 3: Request signature (idempotent)
      const signResult = await this.custody.requestSignature(withdrawalId);

      if (signResult.status === CustodyTxStatus.FAILED) {
        return this.handleFailure(w, operatorId, `Signing failed: ${signResult.failureReason}`);
      }

      if (signResult.status === CustodyTxStatus.REJECTED) {
        return this.handleCustodyRejection(w, operatorId, signResult.failureReason ?? 'Policy rejection');
      }

      await this.audit.logEvent({
        userId: operatorId,
        action: 'withdrawal.signed',
        resourceType: 'withdrawal',
        resourceId: withdrawalId,
        metadata: { status: signResult.status },
      });

      // Step 4: Broadcast (idempotent — returns existing txHash if already broadcast)
      const broadcastResult = await this.custody.broadcast(withdrawalId);

      if (broadcastResult.status === CustodyTxStatus.FAILED) {
        return this.handleFailure(w, operatorId, `Broadcast failed: ${broadcastResult.failureReason}`);
      }

      if (!broadcastResult.txHash) {
        return this.handleFailure(w, operatorId, 'Broadcast returned no txHash');
      }

      // Step 5: Settle — debit locked funds, credit fee to treasury
      await this.settleWithdrawal(w, broadcastResult.txHash, operatorId);

      // Reload final state
      return this.withdrawalRepo.findOneOrFail({ where: { id: withdrawalId } });
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof ForbiddenException) {
        throw err;
      }
      return this.handleFailure(w, operatorId, err instanceof Error ? err.message : String(err));
    } finally {
      this.inflight.delete(withdrawalId);
    }
  }

  /**
   * Check the on-chain status of a processing withdrawal.
   * Used by a polling worker to detect delayed confirmations.
   */
  async checkStatus(withdrawalId: string): Promise<CustodyTxStatus> {
    const result = await this.custody.getStatus(withdrawalId);
    return result.status;
  }

  /**
   * Cancel a pending custody intent (before broadcast).
   */
  async cancelCustodyIntent(
    withdrawalId: string,
    operatorId: string,
  ): Promise<boolean> {
    const cancelled = await this.custody.cancelIntent(withdrawalId);

    if (cancelled) {
      await this.audit.logEvent({
        userId: operatorId,
        action: 'withdrawal.custody_intent_cancelled',
        resourceType: 'withdrawal',
        resourceId: withdrawalId,
      });
    }

    return cancelled;
  }

  /* ─── Settlement ───────────────────────────────────── */

  private async settleWithdrawal(
    w: Withdrawal,
    txHash: string,
    operatorId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // Debit locked funds permanently
      const wallet = await this.wallets.getOrCreate(w.userId, w.asset, manager);
      const locked = new Decimal(wallet.locked);
      const totalDebit = new Decimal(w.amount).plus(w.fee);
      wallet.locked = locked.minus(totalDebit).toFixed();
      await manager.save(wallet);

      // Credit fee to platform treasury
      await this.wallets.creditFee(w.asset, new Decimal(w.fee), manager);

      // Update withdrawal
      w.txHash = txHash;
      w.status = WithdrawalStatus.COMPLETED;
      await manager.save(w);
    });

    await this.audit.logEvent({
      userId: operatorId,
      action: 'withdrawal.broadcast_settled',
      resourceType: 'withdrawal',
      resourceId: w.id,
      metadata: { txHash, amount: w.amount, asset: w.asset, address: w.address },
    });

    this.events.emit('withdrawal.completed', { withdrawal: w });
    this.events.emit('balance.updated', {
      userId: w.userId,
      balances: await this.wallets.getBalances(w.userId),
    });

    this.logger.log(`Withdrawal settled: ${w.amount} ${w.asset} tx=${txHash}`);
  }

  /* ─── Failure handling ─────────────────────────────── */

  private async handleFailure(
    w: Withdrawal,
    operatorId: string,
    reason: string,
  ): Promise<Withdrawal> {
    w.status = WithdrawalStatus.FAILED;
    await this.withdrawalRepo.save(w);

    await this.audit.logEvent({
      userId: operatorId,
      action: 'withdrawal.execution_failed',
      resourceType: 'withdrawal',
      resourceId: w.id,
      metadata: { reason },
    });

    this.events.emit('withdrawal.failed', { withdrawal: w, error: reason });
    this.logger.error(`Withdrawal execution failed: ${w.id} — ${reason}`);

    return w;
  }

  private async handleCustodyRejection(
    w: Withdrawal,
    operatorId: string,
    reason: string,
  ): Promise<Withdrawal> {
    // Custody policy rejected — unlock funds and reject withdrawal
    const totalLocked = new Decimal(w.amount).plus(w.fee);
    await this.wallets.unlockFunds(w.userId, w.asset, totalLocked);

    w.status = WithdrawalStatus.REJECTED;
    w.reviewNote = (w.reviewNote ?? '') + ` | Custody rejected: ${reason}`;
    await this.withdrawalRepo.save(w);

    await this.audit.logEvent({
      userId: operatorId,
      action: 'withdrawal.custody_rejected',
      resourceType: 'withdrawal',
      resourceId: w.id,
      metadata: { reason },
    });

    this.events.emit('withdrawal.rejected', { withdrawal: w });
    this.events.emit('balance.updated', {
      userId: w.userId,
      balances: await this.wallets.getBalances(w.userId),
    });

    return w;
  }
}
