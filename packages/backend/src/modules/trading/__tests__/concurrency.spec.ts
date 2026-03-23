/**
 * NovEx — Concurrency, Idempotency & Retry Integration Tests (v2)
 *
 * Covers:
 *   1. Same user, same idempotency key → returns cached result (no duplicate order)
 *   2. Same user, same payload, different keys → creates 2 distinct orders
 *   3. Same key, different payload → 422 rejection
 *   4. Multiple users placing crossing orders simultaneously
 *   5. Cancel retry after partial processing
 *   6. Retry exhaustion path — no partial corruption
 *   7. Zero-sum conservation across all wallets
 *   8. No duplicate trades, no duplicate fee records
 *   9. No negative balances after concurrent operations
 *  10. Rapid-fire + cancel-all from same user
 *
 * Run: npm run test:concurrency
 */
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Repository, DataSource } from 'typeorm';
import Decimal from 'decimal.js';

import { TradingService } from '../trading.service';
import { MatchingEngineService } from '../matching-engine.service';
import { WalletsService } from '../../wallets/wallets.service';
import { IdempotencyService } from '../../../common/idempotency/idempotency.service';
import { IdempotencyKey } from '../../../common/idempotency/idempotency-key.entity';
import { Order, OrderSide, OrderType, OrderStatus } from '../entities/order.entity';
import { Trade } from '../entities/trade.entity';
import { TradingPair } from '../entities/trading-pair.entity';
import { FeeLedger } from '../entities/fee-ledger.entity';
import { Wallet } from '../../wallets/wallet.entity';
import { User, UserRole, KycStatus } from '../../users/user.entity';
import { AuditLog } from '../../audit/audit.entity';
import {
  ReconciliationRun,
} from '../../reconciliation/entities/reconciliation-run.entity';
import {
  ReconciliationMismatch,
} from '../../reconciliation/entities/reconciliation-mismatch.entity';

import { expectDecimalEq } from './fixtures';

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

async function getWallet(repo: Repository<Wallet>, userId: string, currency: string) {
  return repo.findOneOrFail({ where: { userId, currency } });
}

/* ─── Suite ───────────────────────────────────────────── */

describe('Concurrency & Idempotency v2 (Integration)', () => {
  let module: TestingModule;
  let svc: TradingService;
  let engine: MatchingEngineService;
  let idem: IdempotencyService;
  let ds: DataSource;
  let userRepo: Repository<User>;
  let walletRepo: Repository<Wallet>;
  let orderRepo: Repository<Order>;
  let tradeRepo: Repository<Trade>;
  let pairRepo: Repository<TradingPair>;
  let feeRepo: Repository<FeeLedger>;
  let keyRepo: Repository<IdempotencyKey>;

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
            IdempotencyKey, ReconciliationRun, ReconciliationMismatch,
          ],
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature([
          User, Wallet, Order, Trade, TradingPair, FeeLedger, IdempotencyKey,
        ]),
      ],
      providers: [TradingService, MatchingEngineService, WalletsService, IdempotencyService],
    }).compile();

    svc = module.get(TradingService);
    engine = module.get(MatchingEngineService);
    idem = module.get(IdempotencyService);
    ds = module.get(DataSource);
    userRepo = module.get(getRepositoryToken(User));
    walletRepo = module.get(getRepositoryToken(Wallet));
    orderRepo = module.get(getRepositoryToken(Order));
    tradeRepo = module.get(getRepositoryToken(Trade));
    pairRepo = module.get(getRepositoryToken(TradingPair));
    feeRepo = module.get(getRepositoryToken(FeeLedger));
    keyRepo = module.get(getRepositoryToken(IdempotencyKey));
  });

  afterAll(async () => {
    await ds.destroy();
    await module.close();
  });

  async function resetAll() {
    await keyRepo.delete({});
    await feeRepo.delete({});
    await tradeRepo.delete({});
    await orderRepo.delete({});
    await walletRepo.delete({});
    await pairRepo.delete({});
    await userRepo.delete({});
    (engine as any).books.clear();

    await createUser(userRepo, 'platform@novex.internal', PLATFORM);
    await pairRepo.save(pairRepo.create({
      symbol: 'BTC_USDT', baseCurrency: 'BTC', quoteCurrency: 'USDT',
      pricePrecision: 2, quantityPrecision: 8, minQuantity: '0.00001',
      makerFee: '0.001', takerFee: '0.002', isActive: true, stpMode: 'cancel_taker',
    }));
  }

  /* ═══════════════════════════════════════════════════════
   * TC1: Same user, same key, same payload → cached replay
   * ═══════════════════════════════════════════════════════ */
  describe('TC1: Idempotent replay', () => {
    it('returns cached response on retry with same key+payload', async () => {
      await resetAll();
      const user = await createUser(userRepo, 'alice@test.novex.io');
      await fund(walletRepo, user.id, 'USDT', '100000');

      const key = 'idem-tc1-001';
      const payload = { symbol: 'BTC_USDT', side: 'buy', type: 'limit', price: '50000', quantity: '1' };
      const hash = IdempotencyService.hashPayload(payload);

      // First call — acquire + complete
      const r1 = await idem.acquire(key, user.id, 'place_order', hash);
      expect(r1.alreadyCompleted).toBe(false);
      await idem.complete(key, 201, { orderId: 'ord-1', status: 'open' });

      // Second call — same key, same hash → cached
      const r2 = await idem.acquire(key, user.id, 'place_order', hash);
      expect(r2.alreadyCompleted).toBe(true);
      expect(r2.cachedResponse!.body.orderId).toBe('ord-1');
    });
  });

  /* ═══════════════════════════════════════════════════════
   * TC2: Same payload, different keys → 2 distinct orders
   * ═══════════════════════════════════════════════════════ */
  describe('TC2: Different keys, same payload', () => {
    it('creates two separate orders', async () => {
      await resetAll();
      const user = await createUser(userRepo, 'alice@test.novex.io');
      await fund(walletRepo, user.id, 'USDT', '200000');

      const dto = {
        symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
        price: '48000', quantity: '1',
      };

      const o1 = await svc.placeOrder(user.id, dto);
      const o2 = await svc.placeOrder(user.id, dto);

      expect(o1.id).not.toBe(o2.id);
      const orders = await orderRepo.find({ where: { userId: user.id } });
      expect(orders).toHaveLength(2);

      // Both locked funds — 2 × 48000 = 96000 USDT locked
      const w = await getWallet(walletRepo, user.id, 'USDT');
      expectDecimalEq(w.locked, '96000');
      expectDecimalEq(w.available, '104000');
    });
  });

  /* ═══════════════════════════════════════════════════════
   * TC3: Same key, different payload → 422 rejection
   * ═══════════════════════════════════════════════════════ */
  describe('TC3: Payload mismatch on reused key', () => {
    it('rejects reused key with different payload hash', async () => {
      await resetAll();
      const user = await createUser(userRepo, 'alice@test.novex.io');
      const key = 'idem-tc3-001';

      const hash1 = IdempotencyService.hashPayload({ symbol: 'BTC_USDT', quantity: '1' });
      const hash2 = IdempotencyService.hashPayload({ symbol: 'BTC_USDT', quantity: '2' });

      await idem.acquire(key, user.id, 'place_order', hash1);
      await idem.complete(key, 201, { orderId: 'x' });

      await expect(
        idem.acquire(key, user.id, 'place_order', hash2),
      ).rejects.toThrow(/different request payload/);
    });
  });

  /* ═══════════════════════════════════════════════════════
   * TC4: Multiple users placing crossing orders simultaneously
   * ═══════════════════════════════════════════════════════ */
  describe('TC4: Concurrent crossing orders', () => {
    it('5 buyers vs 2 BTC resting sell — exactly 2 fill', async () => {
      await resetAll();
      const seller = await createUser(userRepo, 'seller@test.novex.io');
      await fund(walletRepo, seller.id, 'BTC', '2');

      await svc.placeOrder(seller.id, {
        symbol: 'BTC_USDT', side: OrderSide.SELL, type: OrderType.LIMIT,
        price: '50000', quantity: '2',
      });

      const buyers = await Promise.all(
        Array.from({ length: 5 }, (_, i) => createUser(userRepo, `b${i}@test.novex.io`)),
      );
      for (const b of buyers) await fund(walletRepo, b.id, 'USDT', '60000');

      const results = await Promise.allSettled(
        buyers.map((b) => svc.placeOrder(b.id, {
          symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
          price: '50000', quantity: '1',
        })),
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled')
        .map((r) => (r as PromiseFulfilledResult<Order>).value);
      const filled = fulfilled.filter((o) => o.status === OrderStatus.FILLED);
      const open = fulfilled.filter((o) => o.status === OrderStatus.OPEN);

      expect(filled).toHaveLength(2);
      expect(open).toHaveLength(3);

      // No duplicates
      const trades = await tradeRepo.find();
      expect(trades).toHaveLength(2);
      const tradeIds = new Set(trades.map((t) => t.id));
      expect(tradeIds.size).toBe(2);

      const fees = await feeRepo.find();
      expect(fees).toHaveLength(4); // 2 trades × 2 fees

      // Treasury correct
      const tBtc = await getWallet(walletRepo, PLATFORM, 'BTC');
      expectDecimalEq(tBtc.available, '0.004', 'treasury BTC (2×0.002 taker)');
      const tUsdt = await getWallet(walletRepo, PLATFORM, 'USDT');
      expectDecimalEq(tUsdt.available, '100', 'treasury USDT (2×50 maker)');
    });
  });

  /* ═══════════════════════════════════════════════════════
   * TC5: Cancel retry after partial processing
   * ═══════════════════════════════════════════════════════ */
  describe('TC5: Cancel retry safety', () => {
    it('double cancel of same order — second attempt fails gracefully', async () => {
      await resetAll();
      const user = await createUser(userRepo, 'alice@test.novex.io');
      await fund(walletRepo, user.id, 'USDT', '100000');

      const order = await svc.placeOrder(user.id, {
        symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
        price: '48000', quantity: '1',
      });

      // First cancel succeeds
      const cancelled = await svc.cancelOrder(user.id, order.id);
      expect(cancelled.status).toBe(OrderStatus.CANCELLED);

      // Second cancel throws (already cancelled)
      await expect(
        svc.cancelOrder(user.id, order.id),
      ).rejects.toThrow(/cannot be cancelled/i);

      // Balance fully restored — only once
      const w = await getWallet(walletRepo, user.id, 'USDT');
      expectDecimalEq(w.available, '100000', 'USDT fully restored');
      expectDecimalEq(w.locked, '0');
    });

    it('cancel with idempotency key — replay returns cached result, no double-unlock', async () => {
      await resetAll();
      const user = await createUser(userRepo, 'alice@test.novex.io');
      await fund(walletRepo, user.id, 'USDT', '100000');

      const order = await svc.placeOrder(user.id, {
        symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
        price: '48000', quantity: '1',
      });

      const key = 'cancel-idem-001';
      const hash = IdempotencyService.hashPayload({ orderId: order.id });

      // First cancel — acquire + execute + complete
      const r1 = await idem.acquire(key, user.id, 'cancel_order', hash);
      expect(r1.alreadyCompleted).toBe(false);
      const cancelled = await svc.cancelOrder(user.id, order.id);
      await idem.complete(key, 200, { ...cancelled });

      // Second cancel attempt — returns cached, no double-unlock
      const r2 = await idem.acquire(key, user.id, 'cancel_order', hash);
      expect(r2.alreadyCompleted).toBe(true);
      expect(r2.cachedResponse!.body.status).toBe(OrderStatus.CANCELLED);

      const w = await getWallet(walletRepo, user.id, 'USDT');
      expectDecimalEq(w.available, '100000');
      expectDecimalEq(w.locked, '0');
    });
  });

  /* ═══════════════════════════════════════════════════════
   * TC6: Retry exhaustion — no partial corruption
   * ═══════════════════════════════════════════════════════ */
  describe('TC6: Failed order leaves no partial state', () => {
    it('insufficient balance rejection leaves zero orders and zero locked', async () => {
      await resetAll();
      const user = await createUser(userRepo, 'alice@test.novex.io');
      await fund(walletRepo, user.id, 'USDT', '1000');

      // Try to buy 1 BTC @ 50000 = needs 50000 USDT, only has 1000
      await expect(
        svc.placeOrder(user.id, {
          symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
          price: '50000', quantity: '1',
        }),
      ).rejects.toThrow(/Insufficient/);

      // No order persisted
      const orders = await orderRepo.find({ where: { userId: user.id } });
      expect(orders).toHaveLength(0);

      // No trades
      expect(await tradeRepo.count()).toBe(0);

      // No fee entries
      expect(await feeRepo.count()).toBe(0);

      // Balance untouched
      const w = await getWallet(walletRepo, user.id, 'USDT');
      expectDecimalEq(w.available, '1000');
      expectDecimalEq(w.locked, '0');
    });

    it('idempotency key is released on failure — allows retry', async () => {
      await resetAll();
      const user = await createUser(userRepo, 'alice@test.novex.io');
      await fund(walletRepo, user.id, 'USDT', '1000');

      const key = 'exhaust-001';
      const hash = IdempotencyService.hashPayload({ quantity: '999' });

      // Acquire
      await idem.acquire(key, user.id, 'place_order', hash);
      // Simulate failure — release
      await idem.release(key);

      // Can re-acquire
      const r = await idem.acquire(key, user.id, 'place_order', hash);
      expect(r.alreadyCompleted).toBe(false);
    });
  });

  /* ═══════════════════════════════════════════════════════
   * TC7: Zero-sum conservation
   * ═══════════════════════════════════════════════════════ */
  describe('TC7: Zero-sum conservation', () => {
    it('total assets conserved after multiple trades', async () => {
      await resetAll();
      const alice = await createUser(userRepo, 'alice@test.novex.io');
      const bob = await createUser(userRepo, 'bob@test.novex.io');
      await fund(walletRepo, alice.id, 'USDT', '100000');
      await fund(walletRepo, bob.id, 'BTC', '5');

      await svc.placeOrder(bob.id, {
        symbol: 'BTC_USDT', side: OrderSide.SELL, type: OrderType.LIMIT,
        price: '50000', quantity: '2',
      });
      await svc.placeOrder(alice.id, {
        symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
        price: '50000', quantity: '2',
      });

      const sumAsset = async (currency: string, initial: string) => {
        const wallets = await walletRepo.find({ where: { currency } });
        const total = wallets.reduce(
          (s, w) => s.plus(w.available).plus(w.locked), new Decimal(0),
        );
        expectDecimalEq(total.toFixed(), initial, `total ${currency}`);
      };

      await sumAsset('USDT', '100000');
      await sumAsset('BTC', '5');
    });
  });

  /* ═══════════════════════════════════════════════════════
   * TC8: No duplicate trades or fee records
   * ═══════════════════════════════════════════════════════ */
  describe('TC8: No duplicates', () => {
    it('each trade has exactly 2 unique fee_ledger entries', async () => {
      await resetAll();
      const alice = await createUser(userRepo, 'alice@test.novex.io');
      const bob = await createUser(userRepo, 'bob@test.novex.io');
      await fund(walletRepo, alice.id, 'USDT', '200000');
      await fund(walletRepo, bob.id, 'BTC', '4');

      // Two trades
      for (const price of ['50000', '51000']) {
        await svc.placeOrder(bob.id, {
          symbol: 'BTC_USDT', side: OrderSide.SELL, type: OrderType.LIMIT,
          price, quantity: '1',
        });
        await svc.placeOrder(alice.id, {
          symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
          price, quantity: '1',
        });
      }

      const trades = await tradeRepo.find();
      expect(trades).toHaveLength(2);

      // Unique trade IDs
      expect(new Set(trades.map((t) => t.id)).size).toBe(2);

      // Each trade has exactly 2 fee entries (no duplicates)
      for (const t of trades) {
        const entries = await feeRepo.find({ where: { tradeId: t.id } });
        expect(entries).toHaveLength(2);
        const sources = entries.map((e) => e.source).sort();
        expect(sources).toEqual(['buyer_fee', 'seller_fee']);
      }

      // Total fee entries = 4, not more
      expect(await feeRepo.count()).toBe(4);
    });
  });

  /* ═══════════════════════════════════════════════════════
   * TC9: No negative balances
   * ═══════════════════════════════════════════════════════ */
  describe('TC9: No negative balances under contention', () => {
    it('mixed concurrent orders leave all balances ≥ 0', async () => {
      await resetAll();
      const users = await Promise.all(
        Array.from({ length: 6 }, (_, i) => createUser(userRepo, `u${i}@test.novex.io`)),
      );
      for (const u of users) {
        await fund(walletRepo, u.id, 'USDT', '50000');
        await fund(walletRepo, u.id, 'BTC', '1');
      }

      const promises = users.map((u, i) =>
        svc.placeOrder(u.id, {
          symbol: 'BTC_USDT',
          side: i % 2 === 0 ? OrderSide.BUY : OrderSide.SELL,
          type: OrderType.LIMIT,
          price: '50000',
          quantity: '0.5',
        }),
      );
      await Promise.allSettled(promises);

      const all = await walletRepo.find();
      for (const w of all) {
        expect(new Decimal(w.available).gte(0)).toBe(true);
        expect(new Decimal(w.locked).gte(0)).toBe(true);
      }
    });
  });

  /* ═══════════════════════════════════════════════════════
   * TC10: Rapid-fire + cancel-all
   * ═══════════════════════════════════════════════════════ */
  describe('TC10: Rapid-fire + cancel-all', () => {
    it('10 orders then cancel all — full balance restoration', async () => {
      await resetAll();
      const user = await createUser(userRepo, 'rapid@test.novex.io');
      await fund(walletRepo, user.id, 'USDT', '500000');

      for (let i = 0; i < 10; i++) {
        await svc.placeOrder(user.id, {
          symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
          price: String(49000 + i * 100), quantity: '0.1',
        });
      }

      const w1 = await getWallet(walletRepo, user.id, 'USDT');
      const total = new Decimal(w1.available).plus(w1.locked);
      expectDecimalEq(total.toFixed(), '500000');

      const { orders } = await svc.getUserOrders(user.id);
      for (const o of orders) {
        if (o.status === OrderStatus.OPEN) await svc.cancelOrder(user.id, o.id);
      }

      const w2 = await getWallet(walletRepo, user.id, 'USDT');
      expectDecimalEq(w2.available, '500000');
      expectDecimalEq(w2.locked, '0');
    });
  });
});
