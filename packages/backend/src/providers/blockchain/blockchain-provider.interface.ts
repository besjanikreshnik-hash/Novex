/**
 * NovEx Blockchain Provider Interface
 *
 * Abstracts blockchain node interactions for deposit detection,
 * address generation, and withdrawal broadcasting.
 * Implementations: AlchemyProvider, MockProvider.
 */

export interface GeneratedAddress {
  address: string;
  /** For chains that need a memo/tag (e.g., Cosmos, XRP) */
  memo?: string;
  /** Provider-specific metadata */
  metadata?: Record<string, any>;
}

export interface DetectedDeposit {
  txHash: string;
  address: string;
  amount: string;
  asset: string;
  network: string;
  confirmations: number;
  blockNumber: number;
}

export interface BroadcastResult {
  txHash: string;
  /** Provider-specific status */
  providerStatus: string;
  /** Estimated time to first confirmation */
  estimatedConfirmationMs?: number;
}

export interface TransactionStatus {
  txHash: string;
  confirmations: number;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
}

export const BLOCKCHAIN_PROVIDER = 'BLOCKCHAIN_PROVIDER';

export interface BlockchainProvider {
  /** Generate a new deposit address for a user */
  generateAddress(userId: string, asset: string, network: string): Promise<GeneratedAddress>;

  /** Poll for new deposits to monitored addresses */
  detectDeposits(addresses: string[], network: string, fromBlock?: number): Promise<DetectedDeposit[]>;

  /** Get current confirmation count for a transaction */
  getTransactionStatus(txHash: string, network: string): Promise<TransactionStatus>;

  /** Broadcast a signed withdrawal transaction */
  broadcastWithdrawal(
    to: string,
    amount: string,
    asset: string,
    network: string,
    memo?: string,
  ): Promise<BroadcastResult>;

  /** Get current block number for a network */
  getCurrentBlock(network: string): Promise<number>;
}
