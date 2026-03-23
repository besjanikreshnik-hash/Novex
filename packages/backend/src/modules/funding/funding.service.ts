import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Decimal from 'decimal.js';
import { Deposit, DepositStatus } from './entities/deposit.entity';
import { Withdrawal, WithdrawalStatus } from './entities/withdrawal.entity';
import { DepositAddress } from './entities/deposit-address.entity';
import { WithdrawalAddressBook } from './entities/withdrawal-address-book.entity';
import { WalletsService } from '../wallets/wallets.service';
import { AuditService } from '../audit/audit.service';

/** Confirmation requirements per network */
const CONFIRMATIONS: Record<string, number> = {
  bitcoin: 3,
  ethereum: 12,
  tron: 20,
  bsc: 15,
};

/** 24h hold for new withdrawal addresses */
const NEW_ADDRESS_HOLD_MS = 24 * 60 * 60 * 1000;

/** Placeholder: withdrawal fees per asset/network */
const WITHDRAWAL_FEES: Record<string, string> = {
  'BTC:bitcoin': '0.0001',
  'ETH:ethereum': '0.001',
  'USDT:ethereum': '5',
  'USDT:tron': '1',
  'SOL:solana': '0.01',
};

@Injectable()
export class FundingService {
  private readonly logger = new Logger(FundingService.name);

  constructor(
    @InjectRepository(Deposit)
    private readonly depositRepo: Repository<Deposit>,
    @InjectRepository(Withdrawal)
    private readonly withdrawalRepo: Repository<Withdrawal>,
    @InjectRepository(DepositAddress)
    private readonly addressRepo: Repository<DepositAddress>,
    @InjectRepository(WithdrawalAddressBook)
    private readonly addressBookRepo: Repository<WithdrawalAddressBook>,
    private readonly wallets: WalletsService,
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
    private readonly audit: AuditService,
  ) {}

  /* ═══════════════════════════════════════════════════════
   * DEPOSIT ADDRESS GENERATION
   * ═══════════════════════════════════════════════════════ */

  async getOrCreateDepositAddress(
    userId: string,
    asset: string,
    network: string,
  ): Promise<DepositAddress> {
    const existing = await this.addressRepo.findOne({
      where: { userId, asset: asset.toUpperCase(), network },
    });
    if (existing) return existing;

    // Placeholder: In production, call blockchain provider to generate address
    const address = this.generatePlaceholderAddress(network);

    const entry = this.addressRepo.create({
      userId,
      asset: asset.toUpperCase(),
      network,
      address,
    });
    return this.addressRepo.save(entry);
  }

  async getUserDepositAddresses(userId: string): Promise<DepositAddress[]> {
    return this.addressRepo.find({ where: { userId } });
  }

  /* ═══════════════════════════════════════════════════════
   * DEPOSIT DETECTION & CREDITING
   * ═══════════════════════════════════════════════════════ */

  /**
   * Called by blockchain monitoring service when a deposit is detected.
   * Creates a pending deposit record. Idempotent on txHash.
   */
  async detectDeposit(dto: {
    userId: string;
    asset: string;
    network: string;
    txHash: string;
    address: string;
    amount: string;
  }): Promise<Deposit> {
    // Idempotent: check if txHash already exists
    const existing = await this.depositRepo.findOne({
      where: { txHash: dto.txHash },
    });
    if (existing) return existing;

    const requiredConfs = CONFIRMATIONS[dto.network] ?? 12;

    const deposit = this.depositRepo.create({
      userId: dto.userId,
      asset: dto.asset.toUpperCase(),
      network: dto.network,
      txHash: dto.txHash,
      address: dto.address,
      amount: dto.amount,
      confirmations: 0,
      requiredConfirmations: requiredConfs,
      status: DepositStatus.PENDING,
    });

    const saved = await this.depositRepo.save(deposit);
    this.events.emit('deposit.detected', { deposit: saved });
    this.logger.log(`Deposit detected: ${dto.amount} ${dto.asset} tx=${dto.txHash}`);
    return saved;
  }

  /**
   * Called by blockchain monitoring service on each new block.
   * Updates confirmation count. Credits wallet when threshold reached.
   */
  async updateConfirmations(
    txHash: string,
    confirmations: number,
  ): Promise<Deposit> {
    const deposit = await this.depositRepo.findOne({ where: { txHash } });
    if (!deposit) {
      throw new NotFoundException(`Deposit with tx ${txHash} not found`);
    }

    if (deposit.status === DepositStatus.CREDITED) {
      return deposit; // already credited — idempotent
    }

    deposit.confirmations = confirmations;

    if (confirmations >= deposit.requiredConfirmations && deposit.status as string !== DepositStatus.CREDITED) {
      // Credit the user's wallet
      deposit.status = DepositStatus.CONFIRMING;
      await this.depositRepo.save(deposit);

      await this.creditDeposit(deposit);
    } else {
      deposit.status = confirmations > 0 ? DepositStatus.CONFIRMING : DepositStatus.PENDING;
      await this.depositRepo.save(deposit);
    }

    return deposit;
  }

  private async creditDeposit(deposit: Deposit): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const wallet = await this.wallets.getOrCreate(
        deposit.userId,
        deposit.asset,
        manager,
      );
      wallet.available = new Decimal(wallet.available).plus(deposit.amount).toFixed();
      await manager.save(wallet);

      deposit.status = DepositStatus.CREDITED;
      deposit.creditedAt = new Date();
      await manager.save(deposit);
    });

    this.events.emit('deposit.credited', { deposit });
    this.events.emit('balance.updated', {
      userId: deposit.userId,
      balances: await this.wallets.getBalances(deposit.userId),
    });
    this.logger.log(`Deposit credited: ${deposit.amount} ${deposit.asset} to user ${deposit.userId}`);
  }

  async getUserDeposits(
    userId: string,
    limit = 20,
    offset = 0,
  ): Promise<{ deposits: Deposit[]; total: number }> {
    const [deposits, total] = await this.depositRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { deposits, total };
  }

  /* ═══════════════════════════════════════════════════════
   * WITHDRAWAL LIFECYCLE
   * ═══════════════════════════════════════════════════════ */

  /**
   * Create a withdrawal request. Locks funds immediately.
   * New addresses get a 24h hold.
   */
  async requestWithdrawal(
    userId: string,
    dto: {
      asset: string;
      network: string;
      address: string;
      memo?: string;
      amount: string;
    },
  ): Promise<Withdrawal> {
    const amount = new Decimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('Amount must be positive');
    }

    // Calculate fee
    const feeKey = `${dto.asset.toUpperCase()}:${dto.network}`;
    const feeStr = WITHDRAWAL_FEES[feeKey] ?? '0';
    const fee = new Decimal(feeStr);
    const totalDebit = amount.plus(fee);

    // Lock funds (amount + fee)
    await this.wallets.lockFunds(userId, dto.asset.toUpperCase(), totalDebit);

    // Check if address is known
    const knownAddress = await this.addressBookRepo.findOne({
      where: {
        userId,
        asset: dto.asset.toUpperCase(),
        network: dto.network,
        address: dto.address,
      },
    });

    const isNew = !knownAddress;
    const holdUntil = isNew ? new Date(Date.now() + NEW_ADDRESS_HOLD_MS) : null;

    // Create withdrawal record
    const withdrawal = this.withdrawalRepo.create({
      userId,
      asset: dto.asset.toUpperCase(),
      network: dto.network,
      address: dto.address,
      memo: dto.memo ?? null,
      amount: amount.toFixed(),
      fee: fee.toFixed(),
      status: isNew ? WithdrawalStatus.HOLD : WithdrawalStatus.PENDING,
      isNewAddress: isNew,
      holdUntil,
    });

    const saved = await this.withdrawalRepo.save(withdrawal);

    // Add to address book
    if (isNew) {
      await this.addressBookRepo.save(this.addressBookRepo.create({
        userId,
        asset: dto.asset.toUpperCase(),
        network: dto.network,
        address: dto.address,
      }));
    }

    this.events.emit('withdrawal.requested', { withdrawal: saved });
    this.events.emit('balance.updated', {
      userId,
      balances: await this.wallets.getBalances(userId),
    });

    this.logger.log(
      `Withdrawal requested: ${amount.toFixed()} ${dto.asset} to ${dto.address} (${isNew ? '24h hold' : 'pending'})`,
    );

    return saved;
  }

  /**
   * Admin: approve a pending/hold withdrawal.
   * Maker-checker: the admin who approves cannot be the same one who processes.
   */
  async approveWithdrawal(
    withdrawalId: string,
    adminUserId: string,
    note?: string,
  ): Promise<Withdrawal> {
    const w = await this.withdrawalRepo.findOneOrFail({ where: { id: withdrawalId } });

    if (w.status !== WithdrawalStatus.PENDING && w.status !== WithdrawalStatus.HOLD) {
      throw new BadRequestException(`Cannot approve withdrawal in status ${w.status}`);
    }

    if (w.holdUntil && new Date() < w.holdUntil) {
      throw new BadRequestException(
        `Withdrawal is on hold until ${w.holdUntil.toISOString()}`,
      );
    }

    // Self-service prohibition: admin cannot approve their own withdrawal
    if (w.userId === adminUserId) {
      throw new ForbiddenException('Cannot approve your own withdrawal');
    }

    w.status = WithdrawalStatus.APPROVED;
    w.reviewedBy = adminUserId;
    w.reviewNote = note ?? null;
    w.reviewedAt = new Date();

    const saved = await this.withdrawalRepo.save(w);

    await this.audit.logEvent({
      userId: adminUserId,
      action: 'withdrawal.approved',
      resourceType: 'withdrawal',
      resourceId: withdrawalId,
      metadata: {
        withdrawalUserId: w.userId,
        amount: w.amount,
        asset: w.asset,
        address: w.address,
        note: note ?? null,
        previousStatus: 'pending_or_hold',
      },
    });

    this.events.emit('withdrawal.approved', { withdrawal: saved });
    return saved;
  }

  /**
   * Admin: reject a withdrawal. Unlocks funds.
   */
  async rejectWithdrawal(
    withdrawalId: string,
    adminUserId: string,
    note: string,
  ): Promise<Withdrawal> {
    const w = await this.withdrawalRepo.findOneOrFail({ where: { id: withdrawalId } });
    const previousStatus = w.status;

    if (
      w.status !== WithdrawalStatus.PENDING &&
      w.status !== WithdrawalStatus.HOLD &&
      w.status !== WithdrawalStatus.APPROVED
    ) {
      throw new BadRequestException(`Cannot reject withdrawal in status ${w.status}`);
    }

    const totalLocked = new Decimal(w.amount).plus(w.fee);
    await this.wallets.unlockFunds(w.userId, w.asset, totalLocked);

    w.status = WithdrawalStatus.REJECTED;
    w.reviewedBy = w.reviewedBy ?? adminUserId; // preserve original reviewer
    w.reviewNote = note;
    w.reviewedAt = new Date();

    const saved = await this.withdrawalRepo.save(w);

    await this.audit.logEvent({
      userId: adminUserId,
      action: 'withdrawal.rejected',
      resourceType: 'withdrawal',
      resourceId: withdrawalId,
      metadata: {
        withdrawalUserId: w.userId,
        amount: w.amount,
        asset: w.asset,
        note,
        previousStatus,
      },
    });

    this.events.emit('withdrawal.rejected', { withdrawal: saved });
    this.events.emit('balance.updated', {
      userId: w.userId,
      balances: await this.wallets.getBalances(w.userId),
    });

    return saved;
  }

  /**
   * Process an approved withdrawal. Called by the withdrawal execution worker.
   *
   * Maker-checker: the admin who processes MUST differ from the admin who approved.
   * This enforces separation of duties — one person reviews, another executes.
   */
  async processWithdrawal(
    withdrawalId: string,
    processorUserId?: string,
  ): Promise<Withdrawal> {
    const w = await this.withdrawalRepo.findOneOrFail({ where: { id: withdrawalId } });

    if (w.status !== WithdrawalStatus.APPROVED) {
      throw new BadRequestException(`Cannot process withdrawal in status ${w.status}`);
    }

    // ── Maker-checker enforcement ─────────────────────
    if (processorUserId && w.reviewedBy && processorUserId === w.reviewedBy) {
      throw new ForbiddenException(
        'Maker-checker violation: the admin who approved this withdrawal cannot also process it. ' +
        'A different admin must execute the withdrawal.',
      );
    }

    w.status = WithdrawalStatus.PROCESSING;
    w.processedBy = processorUserId ?? null;
    w.processedAt = new Date();
    await this.withdrawalRepo.save(w);

    await this.audit.logEvent({
      userId: processorUserId ?? null,
      action: 'withdrawal.processing',
      resourceType: 'withdrawal',
      resourceId: withdrawalId,
      metadata: {
        approvedBy: w.reviewedBy,
        processedBy: processorUserId,
        amount: w.amount,
        asset: w.asset,
        address: w.address,
      },
    });

    try {
      // Placeholder: submit on-chain transaction
      const txHash = `0xplaceholder_${Date.now().toString(16)}`;

      await this.dataSource.transaction(async (manager) => {
        // Debit locked funds permanently
        const wallet = await this.wallets.getOrCreate(w.userId, w.asset, manager);
        const locked = new Decimal(wallet.locked);
        const totalDebit = new Decimal(w.amount).plus(w.fee);
        wallet.locked = locked.minus(totalDebit).toFixed();
        await manager.save(wallet);

        // Credit fee to platform treasury
        await this.wallets.creditFee(w.asset, new Decimal(w.fee), manager);

        w.txHash = txHash;
        w.status = WithdrawalStatus.COMPLETED;
        await manager.save(w);
      });

      this.events.emit('withdrawal.completed', { withdrawal: w });
      this.events.emit('balance.updated', {
        userId: w.userId,
        balances: await this.wallets.getBalances(w.userId),
      });

      await this.audit.logEvent({
        userId: processorUserId ?? null,
        action: 'withdrawal.completed',
        resourceType: 'withdrawal',
        resourceId: withdrawalId,
        metadata: { txHash, amount: w.amount, asset: w.asset, address: w.address },
      });

      this.logger.log(`Withdrawal completed: ${w.amount} ${w.asset} tx=${w.txHash}`);
      return w;
    } catch (err) {
      w.status = WithdrawalStatus.FAILED;
      await this.withdrawalRepo.save(w);

      await this.audit.logEvent({
        userId: processorUserId ?? null,
        action: 'withdrawal.failed',
        resourceType: 'withdrawal',
        resourceId: withdrawalId,
        metadata: { error: err instanceof Error ? err.message : String(err) },
      });

      this.events.emit('withdrawal.failed', { withdrawal: w, error: err });
      this.logger.error(`Withdrawal failed: ${withdrawalId}`, err);
      throw err;
    }
  }

  /**
   * Recover a failed withdrawal. Returns funds to the user.
   */
  async recoverFailedWithdrawal(
    withdrawalId: string,
    adminUserId: string,
  ): Promise<Withdrawal> {
    const w = await this.withdrawalRepo.findOneOrFail({ where: { id: withdrawalId } });

    if (w.status !== WithdrawalStatus.FAILED) {
      throw new BadRequestException('Can only recover failed withdrawals');
    }

    // Unlock funds back to available
    const totalLocked = new Decimal(w.amount).plus(w.fee);
    await this.wallets.unlockFunds(w.userId, w.asset, totalLocked);

    w.status = WithdrawalStatus.REJECTED;
    w.reviewedBy = adminUserId;
    w.reviewNote = 'Recovered from failed state';
    w.reviewedAt = new Date();
    const saved = await this.withdrawalRepo.save(w);

    await this.audit.logEvent({
      userId: adminUserId,
      action: 'withdrawal.recovered',
      resourceType: 'withdrawal',
      resourceId: withdrawalId,
      metadata: {
        withdrawalUserId: w.userId,
        amount: w.amount,
        asset: w.asset,
        originalProcessor: w.processedBy,
      },
    });

    this.events.emit('balance.updated', {
      userId: w.userId,
      balances: await this.wallets.getBalances(w.userId),
    });

    return saved;
  }

  async getUserWithdrawals(
    userId: string,
    limit = 20,
    offset = 0,
  ): Promise<{ withdrawals: Withdrawal[]; total: number }> {
    const [withdrawals, total] = await this.withdrawalRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { withdrawals, total };
  }

  async getPendingWithdrawals(): Promise<Withdrawal[]> {
    return this.withdrawalRepo.find({
      where: [
        { status: WithdrawalStatus.PENDING },
        { status: WithdrawalStatus.HOLD },
      ],
      order: { createdAt: 'ASC' },
    });
  }

  /* ═══════════════════════════════════════════════════════
   * HELPERS
   * ═══════════════════════════════════════════════════════ */

  private generatePlaceholderAddress(network: string): string {
    const hex = Array.from({ length: 20 }, () =>
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0'),
    ).join('');

    switch (network) {
      case 'bitcoin': return `bc1q${hex.slice(0, 38)}`;
      case 'ethereum':
      case 'bsc': return `0x${hex.slice(0, 40)}`;
      case 'tron': return `T${hex.slice(0, 33)}`;
      case 'solana': return hex.slice(0, 44);
      default: return `addr_${hex.slice(0, 40)}`;
    }
  }
}
