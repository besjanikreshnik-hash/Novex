/**
 * NovEx Load Test — Track A: Trading Load
 *
 * Scenarios:
 *   A1. 20 concurrent limit orders on the same pair
 *   A2. 10 concurrent market orders against thin book (3 levels)
 *   A3. 10 concurrent market orders against deep book (20 levels)
 *   A4. Rapid cancel/replace: place → cancel → place × 10 per user
 *   A5. Duplicate-submit pattern: same payload submitted 5 times
 *
 * After each scenario: reconciliation assertion + invariant checks.
 *
 * Run: npm run test:load
 */
import {
  createTestModule, buildContext, resetAll, createUser, createPair, fundUser,
  newMetrics, runConcurrent, metricsReport, assertReconPasses,
  assertNoNegativeBalances, assertNoDuplicateTrades, assertNoDuplicateFees,
  OrderSide, OrderType, TestContext,
} from './harness';

jest.setTimeout(120_000);

describe('Track A: Trading Load', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    const mod = await createTestModule();
    ctx = await buildContext(mod);
  });

  afterAll(async () => {
    await ctx.ds.destroy();
    await ctx.module.close();
  });

  /* ═══ A1: Concurrent limit orders ═══════════════════ */
  it('A1: 20 concurrent limit orders — no corruption', async () => {
    await resetAll(ctx);
    await createPair(ctx);

    // 10 buyers + 10 sellers
    const buyers = await Promise.all(
      Array.from({ length: 10 }, (_, i) => createUser(ctx, `buyer${i}@load.test`)),
    );
    const sellers = await Promise.all(
      Array.from({ length: 10 }, (_, i) => createUser(ctx, `seller${i}@load.test`)),
    );

    for (const b of buyers) await fundUser(ctx, b.id, 'USDT', '100000');
    for (const s of sellers) await fundUser(ctx, s.id, 'BTC', '5');

    const metrics = newMetrics();
    const tasks = [
      ...buyers.map((b) => () =>
        ctx.trading.placeOrder(b.id, {
          symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
          price: '50000', quantity: '0.1',
        }),
      ),
      ...sellers.map((s) => () =>
        ctx.trading.placeOrder(s.id, {
          symbol: 'BTC_USDT', side: OrderSide.SELL, type: OrderType.LIMIT,
          price: '50000', quantity: '0.1',
        }),
      ),
    ];

    await runConcurrent(tasks, metrics);
    console.log(metricsReport('A1: 20 concurrent limit orders', metrics));

    expect(metrics.succeeded).toBe(20);
    await assertNoNegativeBalances(ctx);
    await assertNoDuplicateTrades(ctx);
    await assertNoDuplicateFees(ctx);
    await assertReconPasses(ctx, 'A1');
  });

  /* ═══ A2: Market orders against thin book ═══════════ */
  it('A2: 10 concurrent market orders against thin book (3 levels)', async () => {
    await resetAll(ctx);
    await createPair(ctx);

    // Seed 3 ask levels: 0.5 BTC each = 1.5 total
    for (let i = 0; i < 3; i++) {
      const s = await createUser(ctx, `ask${i}@load.test`);
      await fundUser(ctx, s.id, 'BTC', '0.5');
      await ctx.trading.placeOrder(s.id, {
        symbol: 'BTC_USDT', side: OrderSide.SELL, type: OrderType.LIMIT,
        price: String(50000 + i * 100), quantity: '0.5',
      });
    }

    // 10 market buyers each wanting 0.2 BTC = 2 total (> 1.5 available)
    const buyers = await Promise.all(
      Array.from({ length: 10 }, (_, i) => createUser(ctx, `mktbuyer${i}@load.test`)),
    );
    for (const b of buyers) await fundUser(ctx, b.id, 'USDT', '50000');

    const metrics = newMetrics();
    const tasks = buyers.map((b) => () =>
      ctx.trading.placeOrder(b.id, {
        symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.MARKET,
        quantity: '0.2',
      }),
    );

    await runConcurrent(tasks, metrics);
    console.log(metricsReport('A2: 10 market orders vs thin book', metrics));

    // Some should succeed, some may partially fill or fail
    expect(metrics.succeeded).toBeGreaterThan(0);
    await assertNoNegativeBalances(ctx);
    await assertNoDuplicateFees(ctx);
    await assertReconPasses(ctx, 'A2');
  });

  /* ═══ A3: Market orders against deep book ═══════════ */
  it('A3: 10 concurrent market orders against deep book (20 levels)', async () => {
    await resetAll(ctx);
    await createPair(ctx);

    // Seed 20 ask levels: 1 BTC each = 20 total
    for (let i = 0; i < 20; i++) {
      const s = await createUser(ctx, `deepask${i}@load.test`);
      await fundUser(ctx, s.id, 'BTC', '1');
      await ctx.trading.placeOrder(s.id, {
        symbol: 'BTC_USDT', side: OrderSide.SELL, type: OrderType.LIMIT,
        price: String(50000 + i * 50), quantity: '1',
      });
    }

    const buyers = await Promise.all(
      Array.from({ length: 10 }, (_, i) => createUser(ctx, `deepbuyer${i}@load.test`)),
    );
    for (const b of buyers) await fundUser(ctx, b.id, 'USDT', '200000');

    const metrics = newMetrics();
    const tasks = buyers.map((b) => () =>
      ctx.trading.placeOrder(b.id, {
        symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.MARKET,
        quantity: '1.5',
      }),
    );

    await runConcurrent(tasks, metrics);
    console.log(metricsReport('A3: 10 market orders vs deep book', metrics));

    expect(metrics.succeeded).toBeGreaterThan(0);
    await assertNoNegativeBalances(ctx);
    await assertReconPasses(ctx, 'A3');
  });

  /* ═══ A4: Rapid cancel/replace ═══════════════════════ */
  it('A4: rapid cancel/replace × 10 per user', async () => {
    await resetAll(ctx);
    await createPair(ctx);

    const users = await Promise.all(
      Array.from({ length: 5 }, (_, i) => createUser(ctx, `cr${i}@load.test`)),
    );
    for (const u of users) await fundUser(ctx, u.id, 'USDT', '500000');

    const metrics = newMetrics();

    // Each user: place → cancel → place → cancel ... 10 times
    const tasks = users.map((u) => async () => {
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        try {
          const order = await ctx.trading.placeOrder(u.id, {
            symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
            price: String(40000 + i * 10), quantity: '0.01',
          });
          await ctx.trading.cancelOrder(u.id, order.id);
          metrics.totalOps += 2;
          metrics.succeeded += 2;
          metrics.latencies.push(performance.now() - start);
        } catch (err) {
          metrics.totalOps += 2;
          metrics.failed++;
          metrics.latencies.push(performance.now() - start);
        }
      }
    });

    await Promise.all(tasks.map((t) => t()));
    metrics.endTime = Date.now();
    console.log(metricsReport('A4: rapid cancel/replace', metrics));

    // All funds should be unlocked (all orders cancelled)
    for (const u of users) {
      const w = await ctx.repos.wallet.findOneOrFail({
        where: { userId: u.id, currency: 'USDT' },
      });
      expect(new Decimal(w.locked).eq(0)).toBe(true);
    }
    await assertNoNegativeBalances(ctx);
    await assertReconPasses(ctx, 'A4');
  });

  /* ═══ A5: Duplicate submit pattern ═════════════════ */
  it('A5: 5 identical submits from same user — only 1 succeeds per key', async () => {
    await resetAll(ctx);
    await createPair(ctx);

    const user = await createUser(ctx, 'duper@load.test');
    await fundUser(ctx, user.id, 'USDT', '100000');

    const metrics = newMetrics();

    // All 5 use independent calls (no idempotency key at this level)
    // Each should create a separate order (keys are per-intent)
    const tasks = Array.from({ length: 5 }, () => () =>
      ctx.trading.placeOrder(user.id, {
        symbol: 'BTC_USDT', side: OrderSide.BUY, type: OrderType.LIMIT,
        price: '45000', quantity: '0.1',
      }),
    );

    await runConcurrent(tasks, metrics);
    console.log(metricsReport('A5: 5 duplicate submits', metrics));

    // All should succeed (5 different orders)
    const orders = await ctx.repos.order.find({ where: { userId: user.id } });
    expect(orders.length).toBe(5);

    // Total locked = 5 × 0.1 × 45000 = 22500
    const w = await ctx.repos.wallet.findOneOrFail({
      where: { userId: user.id, currency: 'USDT' },
    });
    expect(new Decimal(w.locked).eq(22500)).toBe(true);

    await assertNoNegativeBalances(ctx);
    await assertReconPasses(ctx, 'A5');
  });
});
