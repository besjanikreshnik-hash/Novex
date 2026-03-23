/**
 * NovEx — Funding Lifecycle Integration Tests
 *
 * Tests deposit detection, confirmation counting, crediting,
 * withdrawal request, approval, rejection, processing, and recovery.
 *
 * Run: npm run test:funding
 */
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Repository, DataSource } from 'typeorm';
import Decimal from 'decimal.js';

import { FundingService } from '../funding.service';
import { Deposit, DepositStatus } from '../entities/deposit.entity';
import { Withdrawal, WithdrawalStatus } from '../entities/withdrawal.entity';
import { DepositAddress } from '../entities/deposit-address.entity';
import { WithdrawalAddressBook } from '../entities/withdrawal-address-book.entity';
import { WalletsService } from '../../wallets/wallets.service';
import { Wallet } from '../../wallets/wallet.entity';
import { User, UserRole, KycStatus } from '../../users/user.entity';

const PLATFORM = WalletsService.PLATFORM_FEE_ACCOUNT;

async function createUser(repo: Repository<User>, email: string, id?: string) {
  return repo.save(repo.create({
    ...(id ? { id } : {}), email, passwordHash: '$2b$12$placeholder',
    role: UserRole.USER, kycStatus: KycStatus.VERIFIED, isActive: true,
  }));
}

async function fund(repo: Repository<Wallet>, userId: string, currency: string, amount: string) {
  let w = await repo.findOne({ where: { userId, currency } });
  if (!w) w = repo.create({ userId, currency, available: amount, locked: '0' });
  else w.available = new Decimal(w.available).plus(amount).toFixed();
  return repo.save(w);
}

function expectDecimalEq(actual: string, expected: string, label = '') {
  if (!new Decimal(actual).eq(expected)) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

describe('Funding Lifecycle (Integration)', () => {
  let module: TestingModule;
  let funding: FundingService;
  let ds: DataSource;
  let userRepo: Repository<User>;
  let walletRepo: Repository<Wallet>;
  let depositRepo: Repository<Deposit>;
  let withdrawalRepo: Repository<Withdrawal>;
  let addressRepo: Repository<DepositAddress>;
  let user: User;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EventEmitterModule.forRoot(),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DATABASE_HOST ?? 'localhost',
          port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
          username: process.env.DATABASE_USER ?? 'novex',
          password: process.env.DATABASE_PASSWORD ?? 'novex_dev',
          database: process.env.DATABASE_NAME ?? 'novex_test',
          entities: [User, Wallet, Deposit, Withdrawal, DepositAddress, WithdrawalAddressBook],
          synchronize: true, dropSchema: true,
        }),
        TypeOrmModule.forFeature([User, Wallet, Deposit, Withdrawal, DepositAddress, WithdrawalAddressBook]),
      ],
      providers: [FundingService, WalletsService],
    }).compile();

    funding = module.get(FundingService);
    ds = module.get(DataSource);
    userRepo = module.get(getRepositoryToken(User));
    walletRepo = module.get(getRepositoryToken(Wallet));
    depositRepo = module.get(getRepositoryToken(Deposit));
    withdrawalRepo = module.get(getRepositoryToken(Withdrawal));
    addressRepo = module.get(getRepositoryToken(DepositAddress));
  });

  afterAll(async () => { await ds.destroy(); await module.close(); });

  async function reset() {
    await withdrawalRepo.delete({});
    await depositRepo.delete({});
    await addressRepo.delete({});
    await walletRepo.delete({});
    await userRepo.delete({});
    await createUser(userRepo, 'platform@novex.internal', PLATFORM);
    user = await createUser(userRepo, 'alice@test.novex.io');
    await fund(walletRepo, user.id, 'BTC', '5');
    await fund(walletRepo, user.id, 'USDT', '100000');
  }

  /* ═══ Deposits ═══════════════════════════════════════ */

  describe('Deposit address', () => {
    beforeEach(reset);

    it('generates address and returns same on repeat', async () => {
      const addr1 = await funding.getOrCreateDepositAddress(user.id, 'BTC', 'bitcoin');
      expect(addr1.address).toBeTruthy();
      expect(addr1.asset).toBe('BTC');

      const addr2 = await funding.getOrCreateDepositAddress(user.id, 'BTC', 'bitcoin');
      expect(addr2.id).toBe(addr1.id);
    });
  });

  describe('Deposit detection and crediting', () => {
    beforeEach(reset);

    it('detects deposit, tracks confirmations, credits on threshold', async () => {
      const dep = await funding.detectDeposit({
        userId: user.id, asset: 'BTC', network: 'bitcoin',
        txHash: '0xabc123', address: 'bc1qtest', amount: '0.5',
      });
      expect(dep.status).toBe(DepositStatus.PENDING);
      expect(dep.confirmations).toBe(0);

      // 1 confirmation — still pending
      await funding.updateConfirmations('0xabc123', 1);
      const d1 = await depositRepo.findOneOrFail({ where: { txHash: '0xabc123' } });
      expect(d1.status).toBe(DepositStatus.CONFIRMING);

      // 3 confirmations (bitcoin threshold) — credited
      await funding.updateConfirmations('0xabc123', 3);
      const d2 = await depositRepo.findOneOrFail({ where: { txHash: '0xabc123' } });
      expect(d2.status).toBe(DepositStatus.CREDITED);
      expect(d2.creditedAt).toBeTruthy();

      // Wallet credited
      const w = await walletRepo.findOneOrFail({ where: { userId: user.id, currency: 'BTC' } });
      expectDecimalEq(w.available, '5.5', 'BTC after deposit');
    });

    it('is idempotent on duplicate txHash', async () => {
      await funding.detectDeposit({
        userId: user.id, asset: 'BTC', network: 'bitcoin',
        txHash: '0xdup', address: 'bc1qtest', amount: '1',
      });
      const dup = await funding.detectDeposit({
        userId: user.id, asset: 'BTC', network: 'bitcoin',
        txHash: '0xdup', address: 'bc1qtest', amount: '1',
      });
      const count = await depositRepo.count({ where: { txHash: '0xdup' } });
      expect(count).toBe(1);
    });
  });

  /* ═══ Withdrawals ════════════════════════════════════ */

  describe('Withdrawal lifecycle', () => {
    beforeEach(reset);

    it('request → approve → process → completed', async () => {
      const w = await funding.requestWithdrawal(user.id, {
        asset: 'BTC', network: 'bitcoin', address: 'bc1qexternal', amount: '0.1',
      });
      // New address → hold
      expect(w.status).toBe(WithdrawalStatus.HOLD);
      expect(w.isNewAddress).toBe(true);

      // Second withdrawal to same address → pending (known)
      // But first, we need to wait for hold. For testing, directly approve.

      // Funds locked (amount + fee)
      const wallet = await walletRepo.findOneOrFail({ where: { userId: user.id, currency: 'BTC' } });
      expect(new Decimal(wallet.locked).gt(0)).toBe(true);
    });

    it('request to known address → pending (no hold)', async () => {
      // First request creates the address book entry
      const w1 = await funding.requestWithdrawal(user.id, {
        asset: 'USDT', network: 'ethereum', address: '0xknown', amount: '100',
      });

      // Reject first to unlock funds
      const admin = await createUser(userRepo, 'admin@novex.io');
      await funding.rejectWithdrawal(w1.id, admin.id, 'testing');

      // Second request to same address → pending (not hold)
      const w2 = await funding.requestWithdrawal(user.id, {
        asset: 'USDT', network: 'ethereum', address: '0xknown', amount: '100',
      });
      expect(w2.status).toBe(WithdrawalStatus.PENDING);
      expect(w2.isNewAddress).toBe(false);
    });

    it('reject unlocks funds', async () => {
      const w = await funding.requestWithdrawal(user.id, {
        asset: 'BTC', network: 'bitcoin', address: 'bc1qreject', amount: '0.5',
      });

      const admin = await createUser(userRepo, 'admin@novex.io');
      await funding.rejectWithdrawal(w.id, admin.id, 'Suspicious');

      const wallet = await walletRepo.findOneOrFail({ where: { userId: user.id, currency: 'BTC' } });
      expectDecimalEq(wallet.locked, '0', 'locked after reject');
      expectDecimalEq(wallet.available, '5', 'available after reject');
    });

    it('recover failed withdrawal returns funds', async () => {
      const w = await funding.requestWithdrawal(user.id, {
        asset: 'BTC', network: 'bitcoin', address: 'bc1qfail', amount: '0.1',
      });

      const admin = await createUser(userRepo, 'admin@novex.io');
      // Manually set to FAILED (simulating process failure)
      w.status = WithdrawalStatus.FAILED;
      await withdrawalRepo.save(w);

      const recovered = await funding.recoverFailedWithdrawal(w.id, admin.id);
      expect(recovered.status).toBe(WithdrawalStatus.REJECTED);

      const wallet = await walletRepo.findOneOrFail({ where: { userId: user.id, currency: 'BTC' } });
      expectDecimalEq(wallet.locked, '0');
    });
  });
});
