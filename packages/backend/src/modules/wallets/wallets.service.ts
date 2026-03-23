import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import Decimal from 'decimal.js';
import { Wallet } from './wallet.entity';
import { withOptimisticRetry } from '../../common/retry';

export interface BalanceDto {
  currency: string;
  available: string;
  locked: string;
  total: string;
}

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
  ) {}

  /* ──── Get all balances for a user ─────────────────── */
  async getBalances(userId: string): Promise<BalanceDto[]> {
    const wallets = await this.walletRepo.find({ where: { userId } });

    return wallets.map((w) => {
      const available = new Decimal(w.available);
      const locked = new Decimal(w.locked);
      return {
        currency: w.currency,
        available: available.toFixed(),
        locked: locked.toFixed(),
        total: available.plus(locked).toFixed(),
      };
    });
  }

  /* ──── Get or create wallet ────────────────────────── */
  async getOrCreate(
    userId: string,
    currency: string,
    manager?: EntityManager,
  ): Promise<Wallet> {
    const repo = manager
      ? manager.getRepository(Wallet)
      : this.walletRepo;

    let wallet = await repo.findOne({
      where: { userId, currency: currency.toUpperCase() },
    });

    if (!wallet) {
      wallet = repo.create({
        userId,
        currency: currency.toUpperCase(),
        available: '0',
        locked: '0',
      });
      wallet = await repo.save(wallet);
    }

    return wallet;
  }

  /* ──── Lock funds (optimistic locking via @Version) ── */
  async lockFunds(
    userId: string,
    currency: string,
    amount: Decimal,
    manager?: EntityManager,
  ): Promise<Wallet> {
    if (amount.lte(0)) {
      throw new BadRequestException('Amount must be positive');
    }

    const doLock = async (): Promise<Wallet> => {
      const repo = manager
        ? manager.getRepository(Wallet)
        : this.walletRepo;

      // Always re-read inside retry to get fresh version
      const wallet = await this.getOrCreate(userId, currency, manager);
      const available = new Decimal(wallet.available);

      if (available.lt(amount)) {
        throw new BadRequestException(
          `Insufficient ${currency} balance. Available: ${available.toFixed()}, Required: ${amount.toFixed()}`,
        );
      }

      wallet.available = available.minus(amount).toFixed();
      wallet.locked = new Decimal(wallet.locked).plus(amount).toFixed();

      return repo.save(wallet); // version check happens automatically
    };

    // Only retry at the top level (no manager = not inside a transaction)
    if (manager) {
      return doLock();
    }
    return withOptimisticRetry(doLock, 3, `lockFunds(${userId}, ${currency})`);
  }

  /* ──── Unlock funds (return to available) ──────────── */
  async unlockFunds(
    userId: string,
    currency: string,
    amount: Decimal,
    manager?: EntityManager,
  ): Promise<Wallet> {
    if (amount.lte(0)) {
      throw new BadRequestException('Amount must be positive');
    }

    const doUnlock = async (): Promise<Wallet> => {
      const repo = manager
        ? manager.getRepository(Wallet)
        : this.walletRepo;

      const wallet = await repo.findOne({
        where: { userId, currency: currency.toUpperCase() },
      });

      if (!wallet) {
        throw new NotFoundException(`No ${currency} wallet found`);
      }

      const locked = new Decimal(wallet.locked);
      if (locked.lt(amount)) {
        throw new BadRequestException('Cannot unlock more than locked amount');
      }

      wallet.locked = locked.minus(amount).toFixed();
      wallet.available = new Decimal(wallet.available).plus(amount).toFixed();

      return repo.save(wallet);
    };

    if (manager) {
      return doUnlock();
    }
    return withOptimisticRetry(doUnlock, 3, `unlockFunds(${userId}, ${currency})`);
  }

  /* ──── Settle trade: deduct locked, credit available ─ */
  async settleTrade(
    userId: string,
    debitCurrency: string,
    debitAmount: Decimal,
    creditCurrency: string,
    creditAmount: Decimal,
    manager: EntityManager,
  ): Promise<void> {
    // Debit locked funds
    const debitWallet = await this.getOrCreate(userId, debitCurrency, manager);
    const locked = new Decimal(debitWallet.locked);
    if (locked.lt(debitAmount)) {
      throw new BadRequestException('Locked balance insufficient for settlement');
    }
    debitWallet.locked = locked.minus(debitAmount).toFixed();
    await manager.save(debitWallet);

    // Credit available funds
    const creditWallet = await this.getOrCreate(userId, creditCurrency, manager);
    creditWallet.available = new Decimal(creditWallet.available)
      .plus(creditAmount)
      .toFixed();
    await manager.save(creditWallet);
  }

  /* ──── Credit fee to platform treasury wallet ────────── */

  /** Well-known user ID for platform fee collection. Deterministic UUID. */
  static readonly PLATFORM_FEE_ACCOUNT = '00000000-0000-0000-0000-000000000001';

  /**
   * Credit collected fee to the platform treasury wallet.
   * Creates the treasury wallet on first use.
   */
  async creditFee(
    asset: string,
    amount: Decimal,
    manager: EntityManager,
  ): Promise<void> {
    if (amount.lte(0)) return; // zero fee — nothing to credit

    const treasury = await this.getOrCreate(
      WalletsService.PLATFORM_FEE_ACCOUNT,
      asset,
      manager,
    );
    treasury.available = new Decimal(treasury.available).plus(amount).toFixed();
    await manager.save(treasury);
  }
}
