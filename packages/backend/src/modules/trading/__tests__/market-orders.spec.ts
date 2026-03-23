/**
 * NovEx — Market Order Integration Tests
 *
 * Tests market buy/sell execution, partial fills, rejection on empty book,
 * slippage, min notional, halted pair, and correct settlement.
 *
 * Run: npm run test:market
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
  if (!w) w = repo.create({ userId, currency, available: amount, locked: '0' });
  else w.available = new Decimal(w.available).plus(amount).toFixed();
  return repo.save(w);
}

async function getWallet(repo: Repository<Wallet>, userId: string, currency: string) {
  return repo.findOneOrFail({ where: { userId, currency } });
}

describe('Market Orders (Integration)', () => {
  let module: TestingModule;
  let svc: TradingService;
  let engine: MatchingEngineService;
  let ds: DataSource;
  let userRepo: Repository<User>;
  let walletRepo: Repository<Wallet>;
  let orderRepo: Repository<Order>;
  let tradeRepo: Repository<Trade>;
  let pairRepo: Repository<TradingPair>;
  let feeRepo: Repository<FeeLedger>;

  let buyer: User;
  let seller: User;
  let pair: TradingPair;

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
    ds = module.get(DataSource);
    userRepo = module.get(getRepositoryToken(User));
    walletRepo = module.get(getRepositoryToken(Wallet));
    orderRepo = module.get(getRepositoryToken(Order));
    tradeRepo = module.get(getRepositoryToken(Trade));
    pairRepo = module.get(getRepositoryToken(TradingPair));
    feeRepo = module.get(getRepositoryToken(FeeLedger));
  });

  afterAll(async () => {
    await ds.destroy();
    await module.close();
  });

  async function resetAll() {
    await feeRepo.delete({});
    await tradeRepo.delete({});
    await orderRepo.delete({});
    await walletRepo.delete({});
    await pairRepo.delete({});
    await userRepo.delete({});
    (engine as any).books.clear();

    await createUser(userRepo, 'platform@novex.internal', PLATFORM);
    buyer = await createUser(userRepo, 'buyer@test.novex.io');
    seller = await createUser(userRepo, 'seller@test.novex.io');
    pair = await pairRepo.save(pairRepo.create({
      symbol: 'BTC_USDT', baseCurrency: 'BTC', quoteCurrency: 'USDT',
      pricePrecision: 2, quantityPrecision: 8, minQuantity: '0.00001',
      makerFee: '0.001', takerFee: '0.002', isActive: true, stpMode: 'cancel_taker',
      maxQuantity: '100', minNotional: '10',
    }));
    await fund(walletRepo, buyer.id, 'USDT', '200000');
    await fund(walletRepo, seller.id, 'BTC', '10');
  }

  /** Seed resting asks at specified levels */
  async function seedAsks(levels: Array<{ price: string; qty: string }>) {
    for (const l of levels) {
      // Create seller2 for each level to avoid STP
      const s = await createUser(userRepo, `seller-${l.price}@test.novex.io`);
      await fund(walletRepo, s.id, 'BTC', l.qty);
      await svc.placeOrder(s.id, {
        symbol: 'BTC_USDT', side: OrderSide.SELL, type: OrderType.LIMIT,
        price: l.price, quantity: l.qty,
      });
    }
  }

  /** Seed resting bids */
  async function seedBids(levels: Array<{ price: string; qty: string }>) {
    for (const l of levels) {
      const b = await createUser(userRepo, `buyer-${l.price}@test.novex.io`);
      await fund(walletRepo, b.id, 'USDT', new Decimal(l.price).times(l.qty).times('1.1').toFixed());
      await svc.placeOrder(b.id, {
        symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
        price: l.price, quantity: l.qty,
      });
    }
  }

  /* ═══════════════════════════════════════════════════════
   * 1. Market buy — full fill
   * ═══════════════════════════════════════════════════════ */
  describe('Market buy full fill', () => {
    beforeEach(resetAll);

    it('fills completely against resting asks', async () => {
      await seedAsks([
        { price: '50000', qty: '1' },
        { price: '50100', qty: '1' },
      ]);

      const order = await svc.placeOrder(buyer.id, {
        symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.MARKET,
        quantity: '1',
      });

      expect(order.status).toBe(OrderStatus.FILLED);
      expectDecimalEq(order.filledQuantity, '1');

      // Trade at maker's price (50000)
      const trades = await tradeRepo.find({ order: { createdAt: 'ASC' } });
      expect(trades).toHaveLength(1);
      expectDecimalEq(trades[0].price, '50000');

      // Buyer received BTC (net of taker fee)
      const buyerBtc = await getWallet(walletRepo, buyer.id, 'BTC');
      expectDecimalEq(buyerBtc.available, '0.998', 'buyer BTC (1 - 0.2% taker fee)');

      // Fee ledger correct
      const fees = await feeRepo.find();
      expect(fees).toHaveLength(2);
    });
  });

  /* ═══════════════════════════════════════════════════════
   * 2. Market sell — full fill
   * ═══════════════════════════════════════════════════════ */
  describe('Market sell full fill', () => {
    beforeEach(resetAll);

    it('fills completely against resting bids', async () => {
      await seedBids([
        { price: '50000', qty: '1' },
        { price: '49900', qty: '1' },
      ]);

      const order = await svc.placeOrder(seller.id, {
        symbol: 'BTC_USDT', side: OrderSide.SELL, type: OrderType.MARKET,
        quantity: '1',
      });

      expect(order.status).toBe(OrderStatus.FILLED);
      expectDecimalEq(order.filledQuantity, '1');

      // Fills at best bid (50000)
      const trades = await tradeRepo.find();
      expect(trades).toHaveLength(1);
      expectDecimalEq(trades[0].price, '50000');
    });
  });

  /* ═══════════════════════════════════════════════════════
   * 3. Partial fill — insufficient depth
   * ═══════════════════════════════════════════════════════ */
  describe('Partial fill on insufficient depth', () => {
    beforeEach(resetAll);

    it('fills what is available, cancels remainder', async () => {
      await seedAsks([{ price: '50000', qty: '0.5' }]);

      const order = await svc.placeOrder(buyer.id, {
        symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.MARKET,
        quantity: '1',
      });

      // Market order partially filled then cancelled (doesn't rest)
      expect(order.status).toBe(OrderStatus.CANCELLED);
      expectDecimalEq(order.filledQuantity, '0.5');

      // Only 0.5 filled
      const trades = await tradeRepo.find();
      expect(trades).toHaveLength(1);
      expectDecimalEq(trades[0].grossBase, '0.5');

      // Excess locked funds returned
      const buyerUsdt = await getWallet(walletRepo, buyer.id, 'USDT');
      // Original: 200000. Locked: ~50500 (with 1% buffer). Spent: 25000. Unlocked excess.
      expect(new Decimal(buyerUsdt.available).gt(0)).toBe(true);
      expectDecimalEq(buyerUsdt.locked, '0', 'no funds remain locked');
    });
  });

  /* ═══════════════════════════════════════════════════════
   * 4. Reject on empty book
   * ═══════════════════════════════════════════════════════ */
  describe('Reject on empty book', () => {
    beforeEach(resetAll);

    it('rejects market buy when no asks exist', async () => {
      await expect(
        svc.placeOrder(buyer.id, {
          symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.MARKET,
          quantity: '1',
        }),
      ).rejects.toThrow(/No liquidity/);

      // No order persisted
      const orders = await orderRepo.find({ where: { userId: buyer.id } });
      expect(orders).toHaveLength(0);
    });

    it('rejects market sell when no bids exist', async () => {
      await expect(
        svc.placeOrder(seller.id, {
          symbol: 'BTC_USDT', side: OrderSide.SELL, type: OrderType.MARKET,
          quantity: '1',
        }),
      ).rejects.toThrow(/No liquidity/);
    });
  });

  /* ═══════════════════════════════════════════════════════
   * 5. Reject on halted pair
   * ═══════════════════════════════════════════════════════ */
  describe('Reject on halted pair', () => {
    beforeEach(resetAll);

    it('rejects market order on inactive pair', async () => {
      pair.isActive = false;
      await pairRepo.save(pair);

      await expect(
        svc.placeOrder(buyer.id, {
          symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.MARKET,
          quantity: '1',
        }),
      ).rejects.toThrow(/not found or inactive/);
    });
  });

  /* ═══════════════════════════════════════════════════════
   * 6. Min notional violation
   * ═══════════════════════════════════════════════════════ */
  describe('Min notional validation', () => {
    beforeEach(resetAll);

    it('rejects order below min notional', async () => {
      await seedAsks([{ price: '50000', qty: '1' }]);

      // minNotional = 10 USDT. Buying 0.0001 BTC @ 50000 = 5 USDT < 10
      await expect(
        svc.placeOrder(buyer.id, {
          symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.MARKET,
          quantity: '0.0001',
        }),
      ).rejects.toThrow(/below minimum/);
    });

    it('accepts order at min notional', async () => {
      await seedAsks([{ price: '50000', qty: '1' }]);

      // 0.001 BTC @ 50000 = 50 USDT > 10 minNotional
      const order = await svc.placeOrder(buyer.id, {
        symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.MARKET,
        quantity: '0.001',
      });
      expect(order.status).toBe(OrderStatus.FILLED);
    });
  });

  /* ═══════════════════════════════════════════════════════
   * 7. Multi-level sweep (market buy across price levels)
   * ═══════════════════════════════════════════════════════ */
  describe('Multi-level sweep', () => {
    beforeEach(resetAll);

    it('sweeps multiple ask levels', async () => {
      await seedAsks([
        { price: '50000', qty: '0.5' },
        { price: '50100', qty: '0.5' },
        { price: '50200', qty: '0.5' },
      ]);

      const order = await svc.placeOrder(buyer.id, {
        symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.MARKET,
        quantity: '1.2',
      });

      expect(order.status).toBe(OrderStatus.FILLED);

      const trades = await tradeRepo.find({ order: { createdAt: 'ASC' } });
      expect(trades).toHaveLength(3);
      expectDecimalEq(trades[0].grossBase, '0.5');
      expectDecimalEq(trades[0].price, '50000');
      expectDecimalEq(trades[1].grossBase, '0.5');
      expectDecimalEq(trades[1].price, '50100');
      expectDecimalEq(trades[2].grossBase, '0.2');
      expectDecimalEq(trades[2].price, '50200');
    });
  });

  /* ═══════════════════════════════════════════════════════
   * 8. Settlement and zero-sum check after market orders
   * ═══════════════════════════════════════════════════════ */
  describe('Settlement integrity', () => {
    beforeEach(resetAll);

    it('total assets conserved after market trade', async () => {
      // Record initial total BTC and USDT
      await seedAsks([{ price: '50000', qty: '2' }]);

      // Snapshot total before market buy
      const walletsBefore = await walletRepo.find();
      const totalUsdtBefore = walletsBefore
        .filter((w) => w.currency === 'USDT')
        .reduce((s, w) => s.plus(w.available).plus(w.locked), new Decimal(0));
      const totalBtcBefore = walletsBefore
        .filter((w) => w.currency === 'BTC')
        .reduce((s, w) => s.plus(w.available).plus(w.locked), new Decimal(0));

      await svc.placeOrder(buyer.id, {
        symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.MARKET,
        quantity: '1',
      });

      const walletsAfter = await walletRepo.find();
      const totalUsdtAfter = walletsAfter
        .filter((w) => w.currency === 'USDT')
        .reduce((s, w) => s.plus(w.available).plus(w.locked), new Decimal(0));
      const totalBtcAfter = walletsAfter
        .filter((w) => w.currency === 'BTC')
        .reduce((s, w) => s.plus(w.available).plus(w.locked), new Decimal(0));

      expectDecimalEq(totalUsdtAfter.toFixed(), totalUsdtBefore.toFixed(), 'USDT conserved');
      expectDecimalEq(totalBtcAfter.toFixed(), totalBtcBefore.toFixed(), 'BTC conserved');
    });
  });
});
