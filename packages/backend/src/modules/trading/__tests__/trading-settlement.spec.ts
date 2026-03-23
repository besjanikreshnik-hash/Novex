/**
 * NovEx — Trading Service & Settlement Integration Tests (v2)
 *
 * Tests the full flow with explicit fee accounting model and STP.
 * Requires a running PostgreSQL database.
 *
 * Run: npm run test:engine:integration
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
import { Order, OrderSide, OrderType, OrderStatus } from '../entities/order.entity';
import { Trade } from '../entities/trade.entity';
import { TradingPair } from '../entities/trading-pair.entity';
import { FeeLedger } from '../entities/fee-ledger.entity';
import { Wallet } from '../../wallets/wallet.entity';
import { User, UserRole, KycStatus } from '../../users/user.entity';
import { AuditLog } from '../../audit/audit.entity';

import { expectDecimalEq, resetFixtures } from './fixtures';

const PLATFORM = WalletsService.PLATFORM_FEE_ACCOUNT;

/* ─── Helpers ─────────────────────────────────────────── */

async function createUser(repo: Repository<User>, email: string): Promise<User> {
  return repo.save(repo.create({
    email,
    passwordHash: '$2b$12$placeholder',
    role: UserRole.USER,
    kycStatus: KycStatus.VERIFIED,
    isActive: true,
  }));
}

async function createPair(
  repo: Repository<TradingPair>,
  overrides: Partial<TradingPair> = {},
): Promise<TradingPair> {
  return repo.save(repo.create({
    symbol: 'BTC_USDT',
    baseCurrency: 'BTC',
    quoteCurrency: 'USDT',
    pricePrecision: 2,
    quantityPrecision: 8,
    minQuantity: '0.00001',
    makerFee: '0.001',  // 0.1%
    takerFee: '0.002',  // 0.2%
    isActive: true,
    stpMode: 'cancel_taker',
    ...overrides,
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

describe('Trading Settlement v2 (Integration)', () => {
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

  // Ensure platform "user" row exists for fee wallet FK
  async function ensurePlatformUser() {
    let u = await userRepo.findOne({ where: { id: PLATFORM } });
    if (!u) {
      u = userRepo.create({
        id: PLATFORM,
        email: 'platform-treasury@novex.internal',
        passwordHash: 'n/a',
        role: UserRole.ADMIN,
        isActive: true,
      });
      await userRepo.save(u);
    }
  }

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
          entities: [User, Wallet, Order, Trade, TradingPair, FeeLedger, AuditLog],
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature([User, Wallet, Order, Trade, TradingPair, FeeLedger]),
      ],
      providers: [TradingService, MatchingEngineService, WalletsService],
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

  beforeEach(async () => {
    resetFixtures();
    await feeRepo.delete({});
    await tradeRepo.delete({});
    await orderRepo.delete({});
    await walletRepo.delete({});
    await pairRepo.delete({});
    await userRepo.delete({});
    (engine as any).books.clear();

    await ensurePlatformUser();
    buyer = await createUser(userRepo, 'buyer@test.novex.io');
    seller = await createUser(userRepo, 'seller@test.novex.io');
    // Asymmetric fees: maker=0.1%, taker=0.2%
    pair = await createPair(pairRepo);
    await fund(walletRepo, buyer.id, 'USDT', '100000');
    await fund(walletRepo, seller.id, 'BTC', '10');
  });

  /* ═══════════════════════════════════════════════════════
   * TC1: Full execution — explicit fee accounting
   * ═══════════════════════════════════════════════════════ */
  it('TC1: buy+sell at same price — correct explicit fees', async () => {
    // Seller rests (maker), buyer takes (taker)
    await svc.placeOrder(seller.id, {
      symbol: 'BTC_USDT', side: OrderSide.SELL, type: OrderType.LIMIT,
      price: '50000', quantity: '1',
    });
    const buyOrder = await svc.placeOrder(buyer.id, {
      symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
      price: '50000', quantity: '1',
    });

    expect(buyOrder.status).toBe(OrderStatus.FILLED);

    // ── Trade record ──
    const trades = await tradeRepo.find({ where: { symbol: 'BTC_USDT' } });
    expect(trades).toHaveLength(1);
    const t = trades[0];

    expectDecimalEq(t.grossBase, '1');
    expectDecimalEq(t.grossQuote, '50000');
    expect(t.buyerFeeAsset).toBe('BTC');              // buyer fee in base
    expectDecimalEq(t.buyerFeeAmount, '0.002');        // 1 * 0.2% taker
    expect(t.sellerFeeAsset).toBe('USDT');             // seller fee in quote
    expectDecimalEq(t.sellerFeeAmount, '50');           // 50000 * 0.1% maker
    expectDecimalEq(t.makerFeeRate, '0.001');
    expectDecimalEq(t.takerFeeRate, '0.002');
    expect(t.buyerUserId).toBe(buyer.id);
    expect(t.sellerUserId).toBe(seller.id);
  });

  /* ═══════════════════════════════════════════════════════
   * TC7: Balance settlement with correct fee deductions
   * ═══════════════════════════════════════════════════════ */
  it('TC7: buyer/seller balances correct — fees deducted from received asset', async () => {
    await svc.placeOrder(seller.id, {
      symbol: 'BTC_USDT', side: OrderSide.SELL, type: OrderType.LIMIT,
      price: '50000', quantity: '1',
    });
    await svc.placeOrder(buyer.id, {
      symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
      price: '50000', quantity: '1',
    });

    // Buyer: debited 50,000 USDT, received 1 - 0.002 = 0.998 BTC
    const buyerUsdt = await getWallet(walletRepo, buyer.id, 'USDT');
    expectDecimalEq(buyerUsdt.available, '50000', 'buyer USDT available');
    expectDecimalEq(buyerUsdt.locked, '0', 'buyer USDT locked');

    const buyerBtc = await getWallet(walletRepo, buyer.id, 'BTC');
    expectDecimalEq(buyerBtc.available, '0.998', 'buyer BTC (net of 0.2% taker fee)');

    // Seller: debited 1 BTC, received 50000 - 50 = 49950 USDT
    const sellerBtc = await getWallet(walletRepo, seller.id, 'BTC');
    expectDecimalEq(sellerBtc.available, '9', 'seller BTC (10 - 1)');
    expectDecimalEq(sellerBtc.locked, '0', 'seller BTC locked');

    const sellerUsdt = await getWallet(walletRepo, seller.id, 'USDT');
    expectDecimalEq(sellerUsdt.available, '49950', 'seller USDT (net of 0.1% maker fee)');
  });

  /* ═══════════════════════════════════════════════════════
   * Fee wallet credits
   * ═══════════════════════════════════════════════════════ */
  it('platform fee wallet credited in correct assets', async () => {
    await svc.placeOrder(seller.id, {
      symbol: 'BTC_USDT', side: OrderSide.SELL, type: OrderType.LIMIT,
      price: '50000', quantity: '1',
    });
    await svc.placeOrder(buyer.id, {
      symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
      price: '50000', quantity: '1',
    });

    // Platform should have collected:
    //   0.002 BTC (buyer taker fee) + 50 USDT (seller maker fee)
    const feeBtc = await getWallet(walletRepo, PLATFORM, 'BTC');
    expectDecimalEq(feeBtc.available, '0.002', 'platform BTC fee');

    const feeUsdt = await getWallet(walletRepo, PLATFORM, 'USDT');
    expectDecimalEq(feeUsdt.available, '50', 'platform USDT fee');

    // Fee ledger entries
    const ledger = await feeRepo.find({ order: { createdAt: 'ASC' } });
    expect(ledger).toHaveLength(2);
    expect(ledger.find(l => l.asset === 'BTC')!.source).toBe('buyer_fee');
    expect(ledger.find(l => l.asset === 'USDT')!.source).toBe('seller_fee');
  });

  /* ═══════════════════════════════════════════════════════
   * Mixed maker/taker: seller is taker
   * ═══════════════════════════════════════════════════════ */
  it('seller-as-taker: fees swap correctly', async () => {
    // Buyer rests (maker 0.1%), seller takes (taker 0.2%)
    await fund(walletRepo, buyer.id, 'USDT', '0'); // already has 100k
    await svc.placeOrder(buyer.id, {
      symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
      price: '50000', quantity: '1',
    });
    await svc.placeOrder(seller.id, {
      symbol: 'BTC_USDT', side: OrderSide.SELL, type: OrderType.LIMIT,
      price: '50000', quantity: '1',
    });

    const trades = await tradeRepo.find({ where: { symbol: 'BTC_USDT' } });
    const t = trades[0];

    // Buyer is maker: fee rate = 0.1%, fee in BTC (buyer receives base)
    expect(t.buyerUserId).toBe(buyer.id);
    expectDecimalEq(t.buyerFeeAmount, '0.001', 'buyer (maker) fee');
    expect(t.buyerFeeAsset).toBe('BTC');

    // Seller is taker: fee rate = 0.2%, fee in USDT (seller receives quote)
    expect(t.sellerUserId).toBe(seller.id);
    expectDecimalEq(t.sellerFeeAmount, '100', 'seller (taker) fee: 50000*0.002');
    expect(t.sellerFeeAsset).toBe('USDT');

    // Buyer: paid 50000 USDT, received 1 - 0.001 = 0.999 BTC
    const buyerBtc = await getWallet(walletRepo, buyer.id, 'BTC');
    expectDecimalEq(buyerBtc.available, '0.999', 'buyer BTC net');

    // Seller: paid 1 BTC, received 50000 - 100 = 49900 USDT
    const sellerUsdt = await getWallet(walletRepo, seller.id, 'USDT');
    expectDecimalEq(sellerUsdt.available, '49900', 'seller USDT net');
  });

  /* ═══════════════════════════════════════════════════════
   * TC2: Partial fill
   * ═══════════════════════════════════════════════════════ */
  it('TC2: partial fill — order status and remaining correct', async () => {
    await fund(walletRepo, seller.id, 'BTC', '5');
    const sell = await svc.placeOrder(seller.id, {
      symbol: 'BTC_USDT', side: OrderSide.SELL, type: OrderType.LIMIT,
      price: '50000', quantity: '5',
    });

    await svc.placeOrder(buyer.id, {
      symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
      price: '50000', quantity: '2',
    });

    const reload = await orderRepo.findOneOrFail({ where: { id: sell.id } });
    expect(reload.status).toBe(OrderStatus.PARTIALLY_FILLED);
    expectDecimalEq(reload.filledQuantity, '2');
    const remaining = new Decimal(reload.quantity).minus(reload.filledQuantity);
    expectDecimalEq(remaining.toFixed(), '3');
  });

  /* ═══════════════════════════════════════════════════════
   * TC4: Insufficient balance
   * ═══════════════════════════════════════════════════════ */
  it('TC4: insufficient balance rejects', async () => {
    await expect(
      svc.placeOrder(buyer.id, {
        symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
        price: '50000', quantity: '3', // needs 150k, has 100k
      }),
    ).rejects.toThrow(/Insufficient/);

    const w = await getWallet(walletRepo, buyer.id, 'USDT');
    expectDecimalEq(w.available, '100000');
    expectDecimalEq(w.locked, '0');
  });

  /* ═══════════════════════════════════════════════════════
   * TC5: Cancel releases locked
   * ═══════════════════════════════════════════════════════ */
  it('TC5: cancel releases locked balance', async () => {
    const order = await svc.placeOrder(buyer.id, {
      symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
      price: '49000', quantity: '1',
    });

    let w = await getWallet(walletRepo, buyer.id, 'USDT');
    expectDecimalEq(w.locked, '49000');

    await svc.cancelOrder(buyer.id, order.id);

    w = await getWallet(walletRepo, buyer.id, 'USDT');
    expectDecimalEq(w.available, '100000');
    expectDecimalEq(w.locked, '0');
  });

  /* ═══════════════════════════════════════════════════════
   * TC8: Trade record persistence
   * ═══════════════════════════════════════════════════════ */
  it('TC8: trade, order, and fee ledger persist correctly', async () => {
    const sell = await svc.placeOrder(seller.id, {
      symbol: 'BTC_USDT', side: OrderSide.SELL, type: OrderType.LIMIT,
      price: '50000', quantity: '1',
    });
    const buy = await svc.placeOrder(buyer.id, {
      symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
      price: '50000', quantity: '1',
    });

    // Trade
    const trades = await tradeRepo.find({ where: { symbol: 'BTC_USDT' } });
    expect(trades).toHaveLength(1);
    expect(trades[0].makerOrderId).toBe(sell.id);
    expect(trades[0].takerOrderId).toBe(buy.id);

    // Orders filled
    const s = await orderRepo.findOneOrFail({ where: { id: sell.id } });
    const b = await orderRepo.findOneOrFail({ where: { id: buy.id } });
    expect(s.status).toBe(OrderStatus.FILLED);
    expect(b.status).toBe(OrderStatus.FILLED);
    expectDecimalEq(s.filledQuote, '50000');
    expectDecimalEq(b.filledQuote, '50000');

    // Fee ledger
    const fees = await feeRepo.find();
    expect(fees).toHaveLength(2);
  });

  /* ═══════════════════════════════════════════════════════
   * TC10: Invalid / halted pair
   * ═══════════════════════════════════════════════════════ */
  it('TC10a: invalid pair rejects', async () => {
    await expect(svc.placeOrder(buyer.id, {
      symbol: 'FAKE_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
      price: '100', quantity: '1',
    })).rejects.toThrow(/not found or inactive/);
  });

  it('TC10b: halted pair rejects', async () => {
    pair.isActive = false;
    await pairRepo.save(pair);

    await expect(svc.placeOrder(buyer.id, {
      symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
      price: '50000', quantity: '1',
    })).rejects.toThrow(/not found or inactive/);
  });

  /* ═══════════════════════════════════════════════════════
   * STP Integration: self-trade rejected, balance restored
   * ═══════════════════════════════════════════════════════ */
  it('STP cancel_taker: self-cross rejected, funds unlocked', async () => {
    // Alice has both BTC and USDT
    const alice = await createUser(userRepo, 'alice@test.novex.io');
    await fund(walletRepo, alice.id, 'USDT', '100000');
    await fund(walletRepo, alice.id, 'BTC', '5');

    // Alice sells 1 BTC
    await svc.placeOrder(alice.id, {
      symbol: 'BTC_USDT', side: OrderSide.SELL, type: OrderType.LIMIT,
      price: '50000', quantity: '1',
    });

    // Alice tries to buy 1 BTC — same user, STP triggers
    const buyOrder = await svc.placeOrder(alice.id, {
      symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
      price: '50000', quantity: '1',
    });

    expect(buyOrder.status).toBe(OrderStatus.CANCELLED);

    // No trades executed
    const trades = await tradeRepo.find({ where: { symbol: 'BTC_USDT' } });
    expect(trades).toHaveLength(0);

    // Buy order's locked USDT should be fully unlocked
    const usdtWallet = await getWallet(walletRepo, alice.id, 'USDT');
    expectDecimalEq(usdtWallet.available, '100000', 'USDT fully restored');
    expectDecimalEq(usdtWallet.locked, '0');

    // Sell order still resting
    const orders = await orderRepo.find({
      where: { userId: alice.id, status: OrderStatus.OPEN },
    });
    expect(orders).toHaveLength(1);
    expect(orders[0].side).toBe(OrderSide.SELL);
  });

  it('STP does not affect cross-user trades', async () => {
    // Normal cross between buyer and seller should work fine with STP enabled
    await svc.placeOrder(seller.id, {
      symbol: 'BTC_USDT', side: OrderSide.SELL, type: OrderType.LIMIT,
      price: '50000', quantity: '1',
    });
    const buy = await svc.placeOrder(buyer.id, {
      symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
      price: '50000', quantity: '1',
    });

    expect(buy.status).toBe(OrderStatus.FILLED);
    const trades = await tradeRepo.find();
    expect(trades).toHaveLength(1);
  });

  /* ═══════════════════════════════════════════════════════
   * Validation edge cases
   * ═══════════════════════════════════════════════════════ */
  it('rejects zero price', async () => {
    await expect(svc.placeOrder(buyer.id, {
      symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
      price: '0', quantity: '1',
    })).rejects.toThrow(/positive/);
  });

  it('rejects below-min quantity', async () => {
    await expect(svc.placeOrder(buyer.id, {
      symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
      price: '50000', quantity: '0.000000001',
    })).rejects.toThrow(/Minimum quantity/);
  });

  it('rejects cancel of other user order', async () => {
    const sell = await svc.placeOrder(seller.id, {
      symbol: 'BTC_USDT', side: OrderSide.SELL, type: OrderType.LIMIT,
      price: '60000', quantity: '1',
    });
    await expect(svc.cancelOrder(buyer.id, sell.id)).rejects.toThrow(/Not your order/);
  });
});
