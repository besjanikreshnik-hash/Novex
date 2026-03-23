/**
 * NovEx Custody Provider Interface
 *
 * Separates signing and broadcast from application logic.
 * Private keys NEVER enter application memory — they live in the
 * custody provider (HSM, MPC service, or hardware wallet).
 *
 * The withdrawal pipeline calls these methods in sequence:
 *   1. createIntent()     — register the withdrawal with the custody system
 *   2. requestSignature() — ask the custody system to sign
 *   3. broadcast()        — submit the signed tx to the network
 *   4. getStatus()        — poll for confirmation
 *
 * Each step is independently retryable and idempotent on intentId.
 */

/** Immutable record of what we intend to send */
export interface WithdrawalIntent {
  /** NovEx-generated unique ID for this withdrawal (= withdrawal.id) */
  intentId: string;
  /** Destination address */
  to: string;
  /** Amount to send (excludes fee — fee is retained by platform) */
  amount: string;
  /** Asset symbol (BTC, ETH, USDT, etc.) */
  asset: string;
  /** Network (ethereum, bitcoin, tron, etc.) */
  network: string;
  /** Optional memo/tag for chains that need it */
  memo?: string;
  /** Metadata for audit */
  metadata?: Record<string, any>;
}

export enum CustodyTxStatus {
  /** Intent registered, not yet signed */
  PENDING_SIGNATURE = 'pending_signature',
  /** Signature in progress (HSM/MPC working) */
  SIGNING = 'signing',
  /** Signed, ready to broadcast */
  SIGNED = 'signed',
  /** Broadcast submitted, awaiting confirmation */
  BROADCAST = 'broadcast',
  /** Confirmed on-chain */
  CONFIRMED = 'confirmed',
  /** Signing or broadcast failed — recoverable */
  FAILED = 'failed',
  /** Rejected by custody policy (e.g., address blocklist) */
  REJECTED = 'rejected',
}

export interface CustodyIntentResult {
  intentId: string;
  /** Custody-provider-specific reference ID */
  providerRef: string;
  status: CustodyTxStatus;
}

export interface CustodySignResult {
  intentId: string;
  status: CustodyTxStatus;
  /** Hex-encoded signed transaction (if status === SIGNED) */
  signedTx?: string;
  /** Reason for failure/rejection */
  failureReason?: string;
}

export interface CustodyBroadcastResult {
  intentId: string;
  status: CustodyTxStatus;
  /** On-chain transaction hash (if broadcast succeeded) */
  txHash?: string;
  /** Provider-specific response */
  providerResponse?: Record<string, any>;
  failureReason?: string;
}

export interface CustodyStatusResult {
  intentId: string;
  status: CustodyTxStatus;
  txHash?: string;
  confirmations?: number;
  blockNumber?: number;
  failureReason?: string;
}

export const CUSTODY_PROVIDER = 'CUSTODY_PROVIDER';

export interface CustodyProvider {
  /**
   * Register a withdrawal intent with the custody system.
   * Idempotent on intentId — calling twice returns the same result.
   */
  createIntent(intent: WithdrawalIntent): Promise<CustodyIntentResult>;

  /**
   * Request the custody system to sign the transaction.
   * May be async (HSM queue, MPC ceremony).
   * Idempotent on intentId.
   */
  requestSignature(intentId: string): Promise<CustodySignResult>;

  /**
   * Broadcast a signed transaction to the blockchain network.
   * Idempotent — if already broadcast, returns the existing txHash.
   */
  broadcast(intentId: string): Promise<CustodyBroadcastResult>;

  /**
   * Check current status of a custody operation.
   * Used for polling confirmation after broadcast.
   */
  getStatus(intentId: string): Promise<CustodyStatusResult>;

  /**
   * Cancel a pending intent (before broadcast).
   * Returns false if already broadcast (cannot cancel).
   */
  cancelIntent(intentId: string): Promise<boolean>;
}
