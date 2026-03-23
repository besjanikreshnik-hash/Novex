import { Logger } from '@nestjs/common';
import {
  CustodyProvider,
  WithdrawalIntent,
  CustodyIntentResult,
  CustodySignResult,
  CustodyBroadcastResult,
  CustodyStatusResult,
  CustodyTxStatus,
} from './custody-provider.interface';

/**
 * Resilient base class for custody providers.
 *
 * Wraps any CustodyProvider implementation with:
 *   - Request timeouts (configurable per operation)
 *   - Bounded retries with exponential backoff
 *   - Structured logging for every operation
 *   - Intent-level idempotency cache (in-memory, prevents duplicate API calls)
 *
 * Subclasses implement the `_doXxx()` methods with raw provider calls.
 */
export interface CustodyTimeouts {
  createIntentMs: number;
  signatureMs: number;
  broadcastMs: number;
  statusMs: number;
}

const DEFAULT_TIMEOUTS: CustodyTimeouts = {
  createIntentMs: 10_000,
  signatureMs: 30_000,   // MPC ceremonies can take time
  broadcastMs: 15_000,
  statusMs: 10_000,
};

export abstract class ResilientCustodyBase implements CustodyProvider {
  protected readonly logger: Logger;
  protected readonly timeouts: CustodyTimeouts;
  protected readonly maxRetries: number;

  /** Intent cache: intentId → last known result (for idempotency without re-calling provider) */
  protected readonly intentCache = new Map<string, {
    providerRef: string;
    status: CustodyTxStatus;
    txHash?: string;
    signedTx?: string;
  }>();

  constructor(
    loggerContext: string,
    timeouts?: Partial<CustodyTimeouts>,
    maxRetries = 2,
  ) {
    this.logger = new Logger(loggerContext);
    this.timeouts = { ...DEFAULT_TIMEOUTS, ...timeouts };
    this.maxRetries = maxRetries;
  }

  /* ─── Public API (with resilience wrapping) ────────── */

  async createIntent(intent: WithdrawalIntent): Promise<CustodyIntentResult> {
    // Idempotency: return cached if already created
    const cached = this.intentCache.get(intent.intentId);
    if (cached) {
      this.logger.log(`createIntent cache hit: ${intent.intentId}`);
      return { intentId: intent.intentId, providerRef: cached.providerRef, status: cached.status };
    }

    const result = await this.withTimeout(
      () => this.withRetry(() => this._doCreateIntent(intent), 'createIntent'),
      this.timeouts.createIntentMs,
      'createIntent',
    );

    this.intentCache.set(intent.intentId, {
      providerRef: result.providerRef,
      status: result.status,
    });

    return result;
  }

  async requestSignature(intentId: string): Promise<CustodySignResult> {
    const cached = this.intentCache.get(intentId);
    if (cached?.signedTx) {
      return { intentId, status: CustodyTxStatus.SIGNED, signedTx: cached.signedTx };
    }

    const result = await this.withTimeout(
      () => this.withRetry(() => this._doRequestSignature(intentId), 'requestSignature'),
      this.timeouts.signatureMs,
      'requestSignature',
    );

    if (result.status === CustodyTxStatus.SIGNED && result.signedTx) {
      const entry = this.intentCache.get(intentId);
      if (entry) { entry.signedTx = result.signedTx; entry.status = result.status; }
    }

    return result;
  }

  async broadcast(intentId: string): Promise<CustodyBroadcastResult> {
    const cached = this.intentCache.get(intentId);
    if (cached?.txHash) {
      return { intentId, status: cached.status, txHash: cached.txHash };
    }

    const result = await this.withTimeout(
      () => this.withRetry(() => this._doBroadcast(intentId), 'broadcast'),
      this.timeouts.broadcastMs,
      'broadcast',
    );

    if (result.txHash) {
      const entry = this.intentCache.get(intentId);
      if (entry) { entry.txHash = result.txHash; entry.status = result.status; }
    }

    return result;
  }

  async getStatus(intentId: string): Promise<CustodyStatusResult> {
    return this.withTimeout(
      () => this._doGetStatus(intentId),
      this.timeouts.statusMs,
      'getStatus',
    );
  }

  async cancelIntent(intentId: string): Promise<boolean> {
    const cached = this.intentCache.get(intentId);
    if (cached?.txHash) return false; // already broadcast

    const result = await this._doCancelIntent(intentId);
    if (result) this.intentCache.delete(intentId);
    return result;
  }

  /* ─── Abstract methods (implement in subclasses) ───── */

  protected abstract _doCreateIntent(intent: WithdrawalIntent): Promise<CustodyIntentResult>;
  protected abstract _doRequestSignature(intentId: string): Promise<CustodySignResult>;
  protected abstract _doBroadcast(intentId: string): Promise<CustodyBroadcastResult>;
  protected abstract _doGetStatus(intentId: string): Promise<CustodyStatusResult>;
  protected abstract _doCancelIntent(intentId: string): Promise<boolean>;

  /* ─── Timeout wrapper ──────────────────────────────── */

  private async withTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    label: string,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.logger.error(`${label} timed out after ${timeoutMs}ms`);
        reject(new Error(`Custody provider timeout: ${label} exceeded ${timeoutMs}ms`));
      }, timeoutMs);

      fn().then(
        (result) => { clearTimeout(timer); resolve(result); },
        (err) => { clearTimeout(timer); reject(err); },
      );
    });
  }

  /* ─── Retry wrapper ────────────────────────────────── */

  private async withRetry<T>(
    fn: () => Promise<T>,
    label: string,
  ): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 8000) + Math.random() * 500;
          this.logger.warn(`${label} attempt ${attempt + 1} failed: ${lastError.message}. Retrying in ${delay.toFixed(0)}ms`);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    this.logger.error(`${label} exhausted ${this.maxRetries + 1} attempts`);
    throw lastError;
  }
}
