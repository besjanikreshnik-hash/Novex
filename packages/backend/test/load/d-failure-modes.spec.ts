/**
 * NovEx Load Test — Track D: Failure Mode Injection
 *
 * Scenarios:
 *   D1. Optimistic lock conflicts on wallet during concurrent orders
 *   D2. Insufficient balance race — many orders, limited funds
 *   D3. Settlement atomicity — partial failure doesn't corrupt state
 *   D4. Deposit crediting idempotency under concurrent confirmations
 *   D5. Withdrawal double-reject safety
 *
 * Run: npm run test:load
 */
import Decimal from 'decimal.js';
import {
  createTestModule, buildContext, resetAll, createUser, createPair, fundUser,
  newMetrics, runConcurrent, metricsReport, assertReconPasses,
  assertNoNegativeBalances, assertNoDuplicateTrades, assertNoDuplicateFees,
  OrderSide, OrderType, TestContext,
} from './harness';

jest.setTimeout(120_000);

describe('Track D: Failure Mode Injection', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    const mod = await createTestModule();
    ctx = await buildContext(mod);
  });

  afterAll(async () => {
    await ctx.ds.destroy();
    await ctx.module.close();
  });

  /* ═══ D1: Optimistic lock contention on same wallet ════ */
  it('D1: 10 concurrent orders from same user — all succeed via retry', async () => {
    await resetAll(ctx);
    await createPair(ctx);
    const user = await createUser(ctx, 'olp@load.test');
    await fundUser(ctx, user.id, 'USDT', '1000000');

    const metrics = newMetrics();
    const tasks = Array.from({ length: 10 }, (_, i) => () =>
      ctx.trading.placeOrder(user.id, {
        symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
        price: String(40000 + i * 100), quantity: '0.01',
      }),
    );

    await runConcurrent(tasks, metrics);
    console.log(metricsReport('D1: OLP contention (10 orders, 1 user)', metrics));

    // All should succeed (retry handles version conflicts)
    expect(metrics.succeeded).toBe(10);

    // Total locked correct
    const w = await ctx.repos.wallet.findOneOrFail({
      where: { userId: user.id, currency: 'USDT' },
    });
    let expectedLocked = new Decimal(0);
    for (let i = 0; i < 10; i++) {
      expectedLocked = expectedLocked.plus(new Decimal(40000 + i * 100).times('0.01'));
    }
    expect(new Decimal(w.locked).eq(expectedLocked)).toBe(true);

    await assertNoNegativeBalances(ctx);
    await assertReconPasses(ctx, 'D1');
  });

  /* ═══ D2: Insufficient balance race ════════════════════ */
  it('D2: 20 orders competing for limited funds — losers rejected cleanly', async () => {
    await resetAll(ctx);
    await createPair(ctx);
    const user = await createUser(ctx, 'race@load.test');
    // Only 50000 USDT — each order needs 50000 USDT
    await fundUser(ctx, user.id, 'USDT', '50000');

    const metrics = newMetrics();
    const tasks = Array.from({ length: 20 }, () => () =>
      ctx.trading.placeOrder(user.id, {
        symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
        price: '50000', quantity: '1', // 50000 USDT each
      }),
    );

    await runConcurrent(tasks, metrics);
    console.log(metricsReport('D2: balance race (20 orders, 50K USDT)', metrics));

    // Exactly 1 should succeed, rest fail with insufficient balance
    expect(metrics.succeeded).toBe(1);
    expect(metrics.failed).toBe(19);
    expect(metrics.errors.has('Insufficient USDT balance')).toBe(false); // partial match

    const w = await ctx.repos.wallet.findOneOrFail({
      where: { userId: user.id, currency: 'USDT' },
    });
    // Exactly 50000 locked (one order)
    expect(new Decimal(w.locked).eq(50000)).toBe(true);
    expect(new Decimal(w.available).eq(0)).toBe(true);

    await assertNoNegativeBalances(ctx);
    await assertReconPasses(ctx, 'D2');
  });

  /* ═══ D3: Settlement atomicity ═════════════════════════ */
  it('D3: trade settlement — verify atomic (all-or-nothing)', async () => {
    await resetAll(ctx);
    await createPair(ctx);

    const seller = await createUser(ctx, 'seller@load.test');
    const buyer = await createUser(ctx, 'buyer@load.test');
    await fundUser(ctx, seller.id, 'BTC', '1');
    await fundUser(ctx, buyer.id, 'USDT', '60000');

    // Place matching orders
    await ctx.trading.placeOrder(seller.id, {
      symbol: 'BTC_USDT', side: OrderSide.SELL, type: OrderType.LIMIT,
      price: '50000', quantity: '1',
    });
    await ctx.trading.placeOrder(buyer.id, {
      symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
      price: '50000', quantity: '1',
    });

    // Verify complete settlement: exactly 1 trade, 2 fee entries
    const trades = await ctx.repos.trade.find();
    expect(trades).toHaveLength(1);

    const fees = await ctx.repos.fee.find();
    expect(fees).toHaveLength(2);

    // Zero-sum: total USDT and BTC unchanged
    const wallets = await ctx.repos.wallet.find();
    const totalUsdt = wallets
      .filter((w) => w.currency === 'USDT')
      .reduce((s, w) => s.plus(w.available).plus(w.locked), new Decimal(0));
    const totalBtc = wallets
      .filter((w) => w.currency === 'BTC')
      .reduce((s, w) => s.plus(w.available).plus(w.locked), new Decimal(0));

    expect(totalUsdt.eq(60000)).toBe(true);
    expect(totalBtc.eq(1)).toBe(true);

    await assertNoDuplicateTrades(ctx);
    await assertNoDuplicateFees(ctx);
    await assertReconPasses(ctx, 'D3');
  });

  /* ═══ D4: Deposit confirmation race ════════════════════ */
  it('D4: 10 concurrent confirmation updates for same deposit — credited exactly once', async () => {
    await resetAll(ctx);
    const user = await createUser(ctx, 'deprace@load.test');
    await fundUser(ctx, user.id, 'BTC', '0');

    await ctx.funding.detectDeposit({
      userId: user.id, asset: 'BTC', network: 'bitcoin',
      txHash: '0xrace_dep', address: 'bc1qrace', amount: '1',
    });

    const metrics = newMetrics();

    // 10 concurrent confirmations all saying "3 confirmations" (threshold)
    const tasks = Array.from({ length: 10 }, () => () =>
      ctx.funding.updateConfirmations('0xrace_dep', 3),
    );

    await runConcurrent(tasks, metrics);
    console.log(metricsReport('D4: deposit confirmation race', metrics));

    // Deposit should be credited exactly once
    const dep = await ctx.repos.deposit.findOneOrFail({ where: { txHash: '0xrace_dep' } });
    expect(dep.status).toBe('credited');

    // Balance should be exactly 1 BTC (not 10!)
    const w = await ctx.repos.wallet.findOneOrFail({
      where: { userId: user.id, currency: 'BTC' },
    });
    expect(new Decimal(w.available).eq(1)).toBe(true);
  });

  /* ═══ D5: Withdrawal double-reject safety ══════════════ */
  it('D5: concurrent reject of same withdrawal — funds unlocked once', async () => {
    await resetAll(ctx);
    const user = await createUser(ctx, 'dblreject@load.test');
    const admin = await createUser(ctx, 'admin@load.test');
    await fundUser(ctx, user.id, 'USDT', '10000');

    const w = await ctx.funding.requestWithdrawal(user.id, {
      asset: 'USDT', network: 'ethereum', address: '0xdblreject', amount: '1000',
    });

    const metrics = newMetrics();

    // 5 concurrent reject attempts
    const tasks = Array.from({ length: 5 }, () => () =>
      ctx.funding.rejectWithdrawal(w.id, admin.id, 'double reject test'),
    );

    await runConcurrent(tasks, metrics);
    console.log(metricsReport('D5: double reject race', metrics));

    // Exactly 1 should succeed, rest should fail (already rejected)
    expect(metrics.succeeded).toBe(1);

    // Funds unlocked exactly once
    const wallet = await ctx.repos.wallet.findOneOrFail({
      where: { userId: user.id, currency: 'USDT' },
    });
    expect(new Decimal(wallet.locked).eq(0)).toBe(true);
    // Available = 10000 (original) — funds restored
    expect(new Decimal(wallet.available).eq(10000)).toBe(true);

    await assertNoNegativeBalances(ctx);
  });
});
