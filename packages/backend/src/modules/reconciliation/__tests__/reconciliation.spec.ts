/**
 * NovEx — Reconciliation Integration Tests
 *
 * Tests all invariant checks: happy path (no mismatches) and
 * targeted corruption scenarios to verify detection.
 *
 * Run: npm run test:recon
 */
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Repository, DataSource } from 'typeorm';
import Decimal from 'decimal.js';

import { ReconciliationService } from '../reconciliation.service';
import {
  ReconciliationRun,
  ReconciliationStatus,
} from '../entities/reconciliation-run.entity';
import {
  ReconciliationMismatch,
  MismatchType,
} from '../entities/reconciliation-mismatch.entity';
import { Wallet } from '../../wallets/wallet.entity';
import { Trade } from '../../trading/entities/trade.entity';
import { Order, OrderSide, OrderType, OrderStatus } from '../../trading/entities/order.entity';
import { TradingPair } from '../../trading/entities/trading-pair.entity';
import { FeeLedger } from '../../trading/entities/fee-ledger.entity';
import { User, UserRole, KycStatus } from '../../users/user.entity';
import { AuditLog } from '../../audit/audit.entity';
import { TradingService } from '../../trading/trading.service';
import { MatchingEngineService } from '../../trading/matching-engine.service';
import { WalletsService } from '../../wallets/wallets.service';

const PLATFORM = WalletsService.PLATFORM_FEE_ACCOUNT;

/* ─── Helpers ─────────────────────────────────────────── */

async function createUser(repo: Repository<User>, email: string, id?: string) {
  return repo.save(repo.create({
    ...(id ? { id } : {}),
    email,
    passwordHash: '$2b$12$placeholder',
    role: UserRole.USER,
    kycStatus: KycStatus.VERIFIED,
    isActive: true,
  }));
}

async function fund(repo: Repository<Wallet>, userId: string, currency: string, amount: string) {
  let w = await repo.findOne({ where: { userId, currency } });
  if (!w) {
    w = repo.create({ userId, currency, available: amount, locked: '0' });
  } else {
    w.available = new Decimal(w.available).plus(amount).toFixed();
  }
  return repo.save(w);
}

/* ─── Suite ───────────────────────────────────────────── */

describe('ReconciliationService', () => {
  let module: TestingModule;
  let recon: ReconciliationService;
  let tradingSvc: TradingService;
  let engine: MatchingEngineService;
  let ds: DataSource;
  let userRepo: Repository<User>;
  let walletRepo: Repository<Wallet>;
  let orderRepo: Repository<Order>;
  let tradeRepo: Repository<Trade>;
  let pairRepo: Repository<TradingPair>;
  let feeRepo: Repository<FeeLedger>;
  let runRepo: Repository<ReconciliationRun>;
  let mismatchRepo: Repository<ReconciliationMismatch>;

  let buyer: User;
  let seller: User;

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
          entities: [
            User, Wallet, Order, Trade, TradingPair, FeeLedger, AuditLog,
            ReconciliationRun, ReconciliationMismatch,
          ],
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature([
          User, Wallet, Order, Trade, TradingPair, FeeLedger,
          ReconciliationRun, ReconciliationMismatch,
        ]),
      ],
      providers: [
        ReconciliationService,
        TradingService,
        MatchingEngineService,
        WalletsService,
      ],
    }).compile();

    recon = module.get(ReconciliationService);
    tradingSvc = module.get(TradingService);
    engine = module.get(MatchingEngineService);
    ds = module.get(DataSource);
    userRepo = module.get(getRepositoryToken(User));
    walletRepo = module.get(getRepositoryToken(Wallet));
    orderRepo = module.get(getRepositoryToken(Order));
    tradeRepo = module.get(getRepositoryToken(Trade));
    pairRepo = module.get(getRepositoryToken(TradingPair));
    feeRepo = module.get(getRepositoryToken(FeeLedger));
    runRepo = module.get(getRepositoryToken(ReconciliationRun));
    mismatchRepo = module.get(getRepositoryToken(ReconciliationMismatch));
  });

  afterAll(async () => {
    await ds.destroy();
    await module.close();
  });

  /** Clean all state and create standard test fixture */
  async function resetAll() {
    await mismatchRepo.delete({});
    await runRepo.delete({});
    await feeRepo.delete({});
    await tradeRepo.delete({});
    await orderRepo.delete({});
    await walletRepo.delete({});
    await pairRepo.delete({});
    await userRepo.delete({});
    (engine as any).books.clear();

    // Platform treasury user
    await createUser(userRepo, 'platform@novex.internal', PLATFORM);

    buyer = await createUser(userRepo, 'buyer@test.novex.io');
    seller = await createUser(userRepo, 'seller@test.novex.io');

    await pairRepo.save(pairRepo.create({
      symbol: 'BTC_USDT',
      baseCurrency: 'BTC',
      quoteCurrency: 'USDT',
      pricePrecision: 2,
      quantityPrecision: 8,
      minQuantity: '0.00001',
      makerFee: '0.001',
      takerFee: '0.002',
      isActive: true,
      stpMode: 'cancel_taker',
    }));

    await fund(walletRepo, buyer.id, 'USDT', '100000');
    await fund(walletRepo, seller.id, 'BTC', '10');
  }

  /** Execute a standard trade: seller rests 1 BTC @ 50000, buyer takes */
  async function executeStandardTrade() {
    await tradingSvc.placeOrder(seller.id, {
      symbol: 'BTC_USDT', side: OrderSide.SELL, type: OrderType.LIMIT,
      price: '50000', quantity: '1',
    });
    await tradingSvc.placeOrder(buyer.id, {
      symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
      price: '50000', quantity: '1',
    });
  }

  /* ═══════════════════════════════════════════════════════
   * 1. Happy path — no mismatches after clean trade
   * ═══════════════════════════════════════════════════════ */
  describe('Happy path', () => {
    beforeEach(resetAll);

    it('returns PASSED with zero mismatches on clean state (no trades)', async () => {
      const run = await recon.executeRun('test');
      expect(run.status).toBe(ReconciliationStatus.PASSED);
      expect(run.mismatchCount).toBe(0);
      expect(run.checksExecuted).toBeGreaterThan(0);
      expect(run.finishedAt).toBeDefined();
      expect(run.mismatches).toHaveLength(0);
    });

    it('returns PASSED after a clean trade with proper settlement', async () => {
      await executeStandardTrade();

      const run = await recon.executeRun('test');
      expect(run.status).toBe(ReconciliationStatus.PASSED);
      expect(run.mismatchCount).toBe(0);
      expect(run.assetsChecked).toContain('BTC');
      expect(run.assetsChecked).toContain('USDT');
    });
  });

  /* ═══════════════════════════════════════════════════════
   * 2. Missing fee_ledger entry
   * ═══════════════════════════════════════════════════════ */
  describe('Missing fee_ledger entry', () => {
    beforeEach(resetAll);

    it('detects missing buyer fee_ledger entry', async () => {
      await executeStandardTrade();

      // Corrupt: delete buyer_fee ledger entry
      await feeRepo
        .createQueryBuilder()
        .delete()
        .where('source = :src', { src: 'buyer_fee' })
        .execute();

      const run = await recon.executeRun('test');
      expect(run.status).toBe(ReconciliationStatus.FAILED);

      const missing = run.mismatches.filter(
        (m) => m.mismatchType === MismatchType.MISSING_FEE_LEDGER_ENTRY,
      );
      expect(missing.length).toBeGreaterThanOrEqual(1);
      expect(missing[0].asset).toBe('BTC'); // buyer fee asset
      expect(missing[0].referenceType).toBe('trade');
    });
  });

  /* ═══════════════════════════════════════════════════════
   * 3. Treasury balance mismatch
   * ═══════════════════════════════════════════════════════ */
  describe('Treasury balance mismatch', () => {
    beforeEach(resetAll);

    it('detects when treasury wallet has wrong balance', async () => {
      await executeStandardTrade();

      // Corrupt: directly modify treasury BTC balance
      const treasuryBtc = await walletRepo.findOneOrFail({
        where: { userId: PLATFORM, currency: 'BTC' },
      });
      treasuryBtc.available = '999'; // clearly wrong
      await walletRepo.save(treasuryBtc);

      const run = await recon.executeRun('test');
      expect(run.status).toBe(ReconciliationStatus.FAILED);

      const drift = run.mismatches.filter(
        (m) =>
          m.mismatchType === MismatchType.FEE_LEDGER_TREASURY_MISMATCH ||
          m.mismatchType === MismatchType.SETTLEMENT_BALANCE_DRIFT,
      );
      expect(drift.length).toBeGreaterThanOrEqual(1);

      const btcMismatch = drift.find((m) => m.asset === 'BTC');
      expect(btcMismatch).toBeDefined();
      expect(btcMismatch!.actualValue).toBe('999');
    });
  });

  /* ═══════════════════════════════════════════════════════
   * 4. Negative locked balance
   * ═══════════════════════════════════════════════════════ */
  describe('Negative locked balance', () => {
    beforeEach(resetAll);

    it('detects negative locked balance on a wallet', async () => {
      // Corrupt: set negative locked
      const wallet = await walletRepo.findOneOrFail({
        where: { userId: buyer.id, currency: 'USDT' },
      });
      wallet.locked = '-100';
      await walletRepo.save(wallet);

      const run = await recon.executeRun('test');
      expect(run.status).toBe(ReconciliationStatus.FAILED);

      const neg = run.mismatches.filter(
        (m) => m.mismatchType === MismatchType.NEGATIVE_LOCKED,
      );
      expect(neg).toHaveLength(1);
      expect(neg[0].referenceId).toBe(wallet.id);
      expect(neg[0].actualValue).toBe('-100');
    });

    it('detects negative available balance', async () => {
      const wallet = await walletRepo.findOneOrFail({
        where: { userId: seller.id, currency: 'BTC' },
      });
      wallet.available = '-0.5';
      await walletRepo.save(wallet);

      const run = await recon.executeRun('test');
      const neg = run.mismatches.filter(
        (m) => m.mismatchType === MismatchType.NEGATIVE_AVAILABLE,
      );
      expect(neg).toHaveLength(1);
      expect(neg[0].referenceId).toBe(wallet.id);
    });
  });

  /* ═══════════════════════════════════════════════════════
   * 5. Trade/wallet inconsistency (settlement drift)
   * ═══════════════════════════════════════════════════════ */
  describe('Settlement balance drift', () => {
    beforeEach(resetAll);

    it('detects when trade fees don\'t match treasury wallet', async () => {
      await executeStandardTrade();

      // Corrupt: zero out the USDT treasury (seller fees went there)
      const treasuryUsdt = await walletRepo.findOneOrFail({
        where: { userId: PLATFORM, currency: 'USDT' },
      });
      treasuryUsdt.available = '0';
      await walletRepo.save(treasuryUsdt);

      const run = await recon.executeRun('test');
      expect(run.status).toBe(ReconciliationStatus.FAILED);

      const drift = run.mismatches.filter(
        (m) =>
          m.mismatchType === MismatchType.SETTLEMENT_BALANCE_DRIFT &&
          m.asset === 'USDT',
      );
      expect(drift).toHaveLength(1);
      // Expected: 50 USDT (seller maker fee on 50000 at 0.1%)
      expect(drift[0].expectedValue).toBe('50');
      expect(drift[0].actualValue).toBe('0');
    });
  });

  /* ═══════════════════════════════════════════════════════
   * 6. Order overfill detection
   * ═══════════════════════════════════════════════════════ */
  describe('Order overfill', () => {
    beforeEach(resetAll);

    it('detects filledQuantity > quantity', async () => {
      await executeStandardTrade();

      // Corrupt: set an order's filledQuantity above its quantity
      const orders = await orderRepo.find();
      const order = orders[0];
      order.filledQuantity = new Decimal(order.quantity).plus('0.1').toFixed();
      await orderRepo.save(order);

      const run = await recon.executeRun('test');
      expect(run.status).toBe(ReconciliationStatus.FAILED);

      const overfills = run.mismatches.filter(
        (m) => m.mismatchType === MismatchType.ORDER_OVERFILL,
      );
      expect(overfills).toHaveLength(1);
      expect(overfills[0].referenceId).toBe(order.id);
    });
  });

  /* ═══════════════════════════════════════════════════════
   * 7. Trade quote consistency
   * ═══════════════════════════════════════════════════════ */
  describe('Trade quote consistency', () => {
    beforeEach(resetAll);

    it('detects gross_quote ≠ price × gross_base', async () => {
      await executeStandardTrade();

      // Corrupt: modify gross_quote
      const trades = await tradeRepo.find();
      trades[0].grossQuote = '12345'; // should be 50000
      await tradeRepo.save(trades[0]);

      const run = await recon.executeRun('test');
      expect(run.status).toBe(ReconciliationStatus.FAILED);

      const quoteMismatch = run.mismatches.filter(
        (m) => m.mismatchType === MismatchType.TRADE_QUOTE_MISMATCH,
      );
      expect(quoteMismatch).toHaveLength(1);
      expect(quoteMismatch[0].actualValue).toBe('12345');
    });
  });

  /* ═══════════════════════════════════════════════════════
   * 8. Run listing and querying
   * ═══════════════════════════════════════════════════════ */
  describe('Run management', () => {
    beforeEach(resetAll);

    it('lists past runs with pagination', async () => {
      await recon.executeRun('test-1');
      await recon.executeRun('test-2');

      const { runs, total } = await recon.listRuns(10, 0);
      expect(total).toBe(2);
      expect(runs).toHaveLength(2);
      // Most recent first
      expect(runs[0].trigger).toBe('test-2');
    });

    it('filters mismatches by type', async () => {
      // Create a negative balance scenario
      const wallet = await walletRepo.findOneOrFail({
        where: { userId: buyer.id, currency: 'USDT' },
      });
      wallet.available = '-50';
      await walletRepo.save(wallet);

      await recon.executeRun('test');

      const { mismatches } = await recon.listMismatches(
        undefined,
        MismatchType.NEGATIVE_AVAILABLE,
      );
      expect(mismatches.length).toBeGreaterThanOrEqual(1);
      expect(mismatches.every((m) => m.mismatchType === MismatchType.NEGATIVE_AVAILABLE)).toBe(true);
    });
  });
});
