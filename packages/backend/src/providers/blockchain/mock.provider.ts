import { Injectable, Logger } from '@nestjs/common';
import {
  BlockchainProvider,
  GeneratedAddress,
  DetectedDeposit,
  BroadcastResult,
  TransactionStatus,
} from './blockchain-provider.interface';

/**
 * Mock Blockchain Provider — for development and testing.
 *
 * Simulates deposit detection, confirmation counting, and withdrawal broadcast.
 * State is entirely in-memory.
 */
@Injectable()
export class MockBlockchainProvider implements BlockchainProvider {
  private readonly logger = new Logger(MockBlockchainProvider.name);
  private addressCounter = 0;
  private blockNumber = 1000;

  /** Pending deposits injected via simulateDeposit() */
  private readonly pendingDeposits: DetectedDeposit[] = [];
  /** Broadcast transactions */
  private readonly broadcasts = new Map<string, { confirmations: number; status: 'pending' | 'confirmed' | 'failed' }>();

  async generateAddress(userId: string, asset: string, network: string): Promise<GeneratedAddress> {
    this.addressCounter++;
    const hex = this.addressCounter.toString(16).padStart(40, '0');
    const address = network === 'bitcoin'
      ? `tb1q${hex.slice(0, 38)}`
      : `0x${hex}`;

    return { address };
  }

  async detectDeposits(addresses: string[], network: string): Promise<DetectedDeposit[]> {
    return this.pendingDeposits.filter(
      (d) => addresses.includes(d.address) && d.network === network,
    );
  }

  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    const entry = this.broadcasts.get(txHash);
    if (!entry) {
      // Check pending deposits
      const deposit = this.pendingDeposits.find((d) => d.txHash === txHash);
      if (deposit) {
        return {
          txHash,
          confirmations: deposit.confirmations,
          status: deposit.confirmations >= 3 ? 'confirmed' : 'pending',
          blockNumber: deposit.blockNumber,
        };
      }
      return { txHash, confirmations: 0, status: 'pending' };
    }
    return { txHash, confirmations: entry.confirmations, status: entry.status };
  }

  async broadcastWithdrawal(
    to: string,
    amount: string,
    asset: string,
    network: string,
  ): Promise<BroadcastResult> {
    const txHash = `0xmock_wd_${Date.now().toString(16)}`;
    this.broadcasts.set(txHash, { confirmations: 0, status: 'pending' });

    this.logger.log(`Mock broadcast: ${amount} ${asset} → ${to} tx=${txHash}`);
    return { txHash, providerStatus: 'mock_broadcast' };
  }

  async getCurrentBlock(): Promise<number> {
    return this.blockNumber;
  }

  /* ─── Test helpers ─────────────────────────────────── */

  /** Simulate an incoming deposit for testing */
  simulateDeposit(deposit: DetectedDeposit): void {
    this.pendingDeposits.push(deposit);
  }

  /** Advance confirmations for a deposit */
  advanceConfirmations(txHash: string, newConfirmations: number): void {
    const dep = this.pendingDeposits.find((d) => d.txHash === txHash);
    if (dep) dep.confirmations = newConfirmations;

    const broadcast = this.broadcasts.get(txHash);
    if (broadcast) {
      broadcast.confirmations = newConfirmations;
      if (newConfirmations >= 3) broadcast.status = 'confirmed';
    }
  }

  /** Simulate a failed broadcast */
  failBroadcast(txHash: string): void {
    const broadcast = this.broadcasts.get(txHash);
    if (broadcast) broadcast.status = 'failed';
  }

  /** Advance the block number */
  advanceBlocks(count: number): void {
    this.blockNumber += count;
  }

  /** Clear all state */
  reset(): void {
    this.pendingDeposits.length = 0;
    this.broadcasts.clear();
    this.blockNumber = 1000;
    this.addressCounter = 0;
  }
}
