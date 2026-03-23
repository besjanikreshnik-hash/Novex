import { Injectable, Logger } from '@nestjs/common';
import {
  CustodyProvider,
  WithdrawalIntent,
  CustodyIntentResult,
  CustodySignResult,
  CustodyBroadcastResult,
  CustodyStatusResult,
  CustodyTxStatus,
} from './custody-provider.interface';

interface MockIntentState {
  intent: WithdrawalIntent;
  providerRef: string;
  status: CustodyTxStatus;
  signedTx: string | null;
  txHash: string | null;
  confirmations: number;
  failureReason: string | null;
}

/**
 * Mock Custody Provider — for development and testing.
 *
 * Simulates the full signing/broadcast lifecycle in memory.
 * Controllable via injectFailure() for testing failure paths.
 */
@Injectable()
export class MockCustodyProvider implements CustodyProvider {
  private readonly logger = new Logger(MockCustodyProvider.name);
  private readonly intents = new Map<string, MockIntentState>();

  /** Inject a failure for the next operation on a specific intent */
  private failures = new Map<string, { stage: 'sign' | 'broadcast'; reason: string }>();

  async createIntent(intent: WithdrawalIntent): Promise<CustodyIntentResult> {
    // Idempotent: return existing if already created
    const existing = this.intents.get(intent.intentId);
    if (existing) {
      this.logger.log(`Intent ${intent.intentId} already exists (idempotent)`);
      return {
        intentId: intent.intentId,
        providerRef: existing.providerRef,
        status: existing.status,
      };
    }

    const providerRef = `mock-ref-${intent.intentId.slice(0, 8)}`;
    const state: MockIntentState = {
      intent,
      providerRef,
      status: CustodyTxStatus.PENDING_SIGNATURE,
      signedTx: null,
      txHash: null,
      confirmations: 0,
      failureReason: null,
    };
    this.intents.set(intent.intentId, state);

    this.logger.log(`Intent created: ${intent.intentId} → ${providerRef}`);
    return { intentId: intent.intentId, providerRef, status: state.status };
  }

  async requestSignature(intentId: string): Promise<CustodySignResult> {
    const state = this.intents.get(intentId);
    if (!state) throw new Error(`Intent ${intentId} not found`);

    // Idempotent: if already signed, return
    if (state.status === CustodyTxStatus.SIGNED || state.status === CustodyTxStatus.BROADCAST || state.status === CustodyTxStatus.CONFIRMED) {
      return { intentId, status: state.status, signedTx: state.signedTx ?? undefined };
    }

    // Check for injected failure
    const failure = this.failures.get(intentId);
    if (failure?.stage === 'sign') {
      this.failures.delete(intentId);
      state.status = CustodyTxStatus.FAILED;
      state.failureReason = failure.reason;
      return { intentId, status: CustodyTxStatus.FAILED, failureReason: failure.reason };
    }

    state.status = CustodyTxStatus.SIGNED;
    state.signedTx = `0xsigned_${intentId.slice(0, 16)}_${Date.now().toString(16)}`;

    this.logger.log(`Intent signed: ${intentId}`);
    return { intentId, status: CustodyTxStatus.SIGNED, signedTx: state.signedTx };
  }

  async broadcast(intentId: string): Promise<CustodyBroadcastResult> {
    const state = this.intents.get(intentId);
    if (!state) throw new Error(`Intent ${intentId} not found`);

    // Idempotent: if already broadcast, return existing txHash
    if (state.status === CustodyTxStatus.BROADCAST || state.status === CustodyTxStatus.CONFIRMED) {
      return { intentId, status: state.status, txHash: state.txHash ?? undefined };
    }

    if (state.status !== CustodyTxStatus.SIGNED) {
      throw new Error(`Cannot broadcast intent in status ${state.status}`);
    }

    // Check for injected failure
    const failure = this.failures.get(intentId);
    if (failure?.stage === 'broadcast') {
      this.failures.delete(intentId);
      state.status = CustodyTxStatus.FAILED;
      state.failureReason = failure.reason;
      return { intentId, status: CustodyTxStatus.FAILED, failureReason: failure.reason };
    }

    state.txHash = `0xtx_${intentId.slice(0, 16)}_${Date.now().toString(16)}`;
    state.status = CustodyTxStatus.BROADCAST;

    this.logger.log(`Intent broadcast: ${intentId} → ${state.txHash}`);
    return { intentId, status: CustodyTxStatus.BROADCAST, txHash: state.txHash };
  }

  async getStatus(intentId: string): Promise<CustodyStatusResult> {
    const state = this.intents.get(intentId);
    if (!state) throw new Error(`Intent ${intentId} not found`);

    return {
      intentId,
      status: state.status,
      txHash: state.txHash ?? undefined,
      confirmations: state.confirmations,
      failureReason: state.failureReason ?? undefined,
    };
  }

  async cancelIntent(intentId: string): Promise<boolean> {
    const state = this.intents.get(intentId);
    if (!state) return false;
    if (state.status === CustodyTxStatus.BROADCAST || state.status === CustodyTxStatus.CONFIRMED) {
      return false; // cannot cancel after broadcast
    }
    this.intents.delete(intentId);
    return true;
  }

  /* ─── Test helpers ─────────────────────────────────── */

  injectFailure(intentId: string, stage: 'sign' | 'broadcast', reason: string): void {
    this.failures.set(intentId, { stage, reason });
  }

  confirmIntent(intentId: string, confirmations = 12): void {
    const state = this.intents.get(intentId);
    if (state) {
      state.status = CustodyTxStatus.CONFIRMED;
      state.confirmations = confirmations;
    }
  }

  reset(): void {
    this.intents.clear();
    this.failures.clear();
  }

  getIntent(intentId: string): MockIntentState | undefined {
    return this.intents.get(intentId);
  }
}
