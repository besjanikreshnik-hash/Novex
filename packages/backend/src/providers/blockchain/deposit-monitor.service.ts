import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { BLOCKCHAIN_PROVIDER, BlockchainProvider } from './blockchain-provider.interface';
import { FundingService } from '../../modules/funding/funding.service';
import { DepositAddress } from '../../modules/funding/entities/deposit-address.entity';
import { Deposit, DepositStatus } from '../../modules/funding/entities/deposit.entity';
import { MetricsService } from '../../common/metrics/metrics.service';

/**
 * Deposit Monitor — polls the blockchain provider for new deposits
 * and confirmation updates.
 *
 * In production, this would also listen to Alchemy Address Activity webhooks
 * for near-real-time detection. The poller serves as a fallback/consistency check.
 *
 * Polling interval: configurable via DEPOSIT_POLL_INTERVAL_MS (default: 30000)
 */
@Injectable()
export class DepositMonitorService implements OnModuleInit {
  private readonly logger = new Logger(DepositMonitorService.name);
  private readonly pollIntervalMs: number;
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(BLOCKCHAIN_PROVIDER) private readonly blockchain: BlockchainProvider,
    private readonly funding: FundingService,
    @InjectRepository(DepositAddress)
    private readonly addressRepo: Repository<DepositAddress>,
    @InjectRepository(Deposit)
    private readonly depositRepo: Repository<Deposit>,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
  ) {
    this.pollIntervalMs = parseInt(
      config.get<string>('DEPOSIT_POLL_INTERVAL_MS', '30000'),
      10,
    );
  }

  onModuleInit() {
    const enabled = this.config.get<string>('DEPOSIT_MONITOR_ENABLED', 'false');
    if (enabled === 'true') {
      this.startPolling();
      this.logger.log(`Deposit monitor started (interval: ${this.pollIntervalMs}ms)`);
    } else {
      this.logger.log('Deposit monitor disabled (set DEPOSIT_MONITOR_ENABLED=true to enable)');
    }
  }

  startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => this.pollCycle(), this.pollIntervalMs);
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Single poll cycle: detect new deposits + update confirmations.
   */
  async pollCycle(): Promise<void> {
    try {
      await this.detectNewDeposits();
      await this.updatePendingConfirmations();
    } catch (err) {
      this.logger.error(`Deposit poll cycle error: ${err}`);
    }
  }

  /**
   * Detect new deposits across all monitored addresses.
   */
  private async detectNewDeposits(): Promise<void> {
    // Group addresses by network
    const allAddresses = await this.addressRepo.find();
    const byNetwork = new Map<string, DepositAddress[]>();
    for (const addr of allAddresses) {
      const list = byNetwork.get(addr.network) ?? [];
      list.push(addr);
      byNetwork.set(addr.network, list);
    }

    for (const [network, addresses] of byNetwork) {
      const addrStrings = addresses.map((a) => a.address);
      const deposits = await this.blockchain.detectDeposits(addrStrings, network);

      for (const det of deposits) {
        // Find which user owns this address
        const addrEntry = addresses.find((a) => a.address.toLowerCase() === det.address.toLowerCase());
        if (!addrEntry) continue;

        try {
          await this.funding.detectDeposit({
            userId: addrEntry.userId,
            asset: addrEntry.asset,
            network: det.network,
            txHash: det.txHash,
            address: det.address,
            amount: det.amount,
          });
        } catch {
          // detectDeposit is idempotent — duplicate txHash is expected
        }
      }
    }
  }

  /**
   * Update confirmation counts for pending/confirming deposits.
   */
  private async updatePendingConfirmations(): Promise<void> {
    const pending = await this.depositRepo.find({
      where: [
        { status: DepositStatus.PENDING },
        { status: DepositStatus.CONFIRMING },
      ],
    });

    for (const deposit of pending) {
      try {
        const status = await this.blockchain.getTransactionStatus(
          deposit.txHash,
          deposit.network,
        );
        if (status.confirmations > deposit.confirmations) {
          await this.funding.updateConfirmations(deposit.txHash, status.confirmations);
        }
      } catch (err) {
        this.logger.warn(`Failed to check confirmations for ${deposit.txHash}: ${err}`);
      }
    }
  }
}
