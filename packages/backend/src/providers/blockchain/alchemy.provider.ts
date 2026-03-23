import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BlockchainProvider,
  GeneratedAddress,
  DetectedDeposit,
  BroadcastResult,
  TransactionStatus,
} from './blockchain-provider.interface';

/**
 * Alchemy Blockchain Provider — Sandbox/Testnet Implementation
 *
 * Uses Alchemy's Enhanced APIs for Ethereum-based chains (ETH, USDT-ERC20).
 * For Bitcoin, falls back to a separate endpoint or mock.
 *
 * Required env vars:
 *   ALCHEMY_API_KEY       — Alchemy API key
 *   ALCHEMY_NETWORK       — e.g., 'eth-sepolia' for testnet
 *   ALCHEMY_WEBHOOK_ID    — Address Activity webhook ID
 *   ALCHEMY_BASE_URL      — e.g., https://eth-sepolia.g.alchemy.com/v2
 *
 * In sandbox mode:
 *   - Uses Sepolia testnet for ETH/ERC20
 *   - generateAddress returns a deterministic testnet address
 *   - broadcastWithdrawal returns a mock txHash (real on-chain signing requires HSM)
 */
@Injectable()
export class AlchemyProvider implements BlockchainProvider {
  private readonly logger = new Logger(AlchemyProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('ALCHEMY_API_KEY', '');
    this.baseUrl = config.get<string>(
      'ALCHEMY_BASE_URL',
      'https://eth-sepolia.g.alchemy.com/v2',
    );
  }

  async generateAddress(userId: string, asset: string, network: string): Promise<GeneratedAddress> {
    // In production: derive from HD wallet using user index
    // In sandbox: generate a deterministic testnet address
    const hash = this.simpleHash(`${userId}:${asset}:${network}`);
    const address = network === 'bitcoin'
      ? `tb1q${hash.slice(0, 38)}`  // testnet bech32
      : `0x${hash.slice(0, 40)}`;    // EVM

    this.logger.log(`Generated ${network} address for user ${userId}: ${address}`);
    return { address };
  }

  async detectDeposits(
    addresses: string[],
    network: string,
    fromBlock?: number,
  ): Promise<DetectedDeposit[]> {
    if (!this.apiKey) {
      this.logger.warn('ALCHEMY_API_KEY not set — skipping deposit detection');
      return [];
    }

    if (network !== 'ethereum' && network !== 'bsc') {
      this.logger.debug(`Deposit detection not implemented for ${network} — use webhook`);
      return [];
    }

    try {
      // Use Alchemy's alchemy_getAssetTransfers API
      const response = await this.rpcCall('alchemy_getAssetTransfers', [{
        fromBlock: fromBlock ? `0x${fromBlock.toString(16)}` : 'latest',
        toBlock: 'latest',
        toAddress: addresses.length === 1 ? addresses[0] : undefined,
        category: ['external', 'erc20'],
        withMetadata: true,
        excludeZeroValue: true,
        maxCount: '0x64', // 100
      }]);

      if (!response?.transfers) return [];

      return response.transfers
        .filter((tx: any) => addresses.includes(tx.to?.toLowerCase()))
        .map((tx: any) => ({
          txHash: tx.hash,
          address: tx.to,
          amount: String(tx.value ?? '0'),
          asset: tx.asset === 'ETH' ? 'ETH' : tx.rawContract?.address ? 'USDT' : tx.asset,
          network,
          confirmations: 0, // will be filled by getTransactionStatus
          blockNumber: parseInt(tx.blockNum, 16),
        }));
    } catch (err) {
      this.logger.error(`Alchemy detectDeposits error: ${err}`);
      return [];
    }
  }

  async getTransactionStatus(txHash: string, network: string): Promise<TransactionStatus> {
    if (!this.apiKey) {
      return { txHash, confirmations: 0, status: 'pending' };
    }

    try {
      const receipt = await this.rpcCall('eth_getTransactionReceipt', [txHash]);
      if (!receipt) {
        return { txHash, confirmations: 0, status: 'pending' };
      }

      const txBlock = parseInt(receipt.blockNumber, 16);
      const currentBlock = await this.getCurrentBlock(network);
      const confirmations = currentBlock - txBlock + 1;

      return {
        txHash,
        confirmations: Math.max(0, confirmations),
        status: receipt.status === '0x1' ? 'confirmed' : 'failed',
        blockNumber: txBlock,
      };
    } catch (err) {
      this.logger.error(`getTransactionStatus error: ${err}`);
      return { txHash, confirmations: 0, status: 'pending' };
    }
  }

  async broadcastWithdrawal(
    to: string,
    amount: string,
    asset: string,
    network: string,
    memo?: string,
  ): Promise<BroadcastResult> {
    // In production: sign with HSM/KMS and broadcast via eth_sendRawTransaction
    // In sandbox: return a mock txHash
    this.logger.warn(
      `Sandbox withdrawal broadcast: ${amount} ${asset} → ${to} (mock — real signing requires HSM)`,
    );

    const mockHash = `0x${this.simpleHash(`wd:${to}:${amount}:${Date.now()}`).slice(0, 64)}`;

    return {
      txHash: mockHash,
      providerStatus: 'sandbox_mock',
      estimatedConfirmationMs: 15000,
    };
  }

  async getCurrentBlock(network: string): Promise<number> {
    if (!this.apiKey) return 0;

    try {
      const result = await this.rpcCall('eth_blockNumber', []);
      return parseInt(result, 16);
    } catch {
      return 0;
    }
  }

  /* ─── RPC helper ───────────────────────────────────── */

  private async rpcCall(method: string, params: any[]): Promise<any> {
    const url = `${this.baseUrl}/${this.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      }),
    });

    if (!res.ok) {
      throw new Error(`Alchemy RPC error: ${res.status}`);
    }

    const data = await res.json();
    if (data.error) {
      throw new Error(`Alchemy RPC error: ${data.error.message}`);
    }
    return data.result;
  }

  private simpleHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(40, 'a');
  }
}
