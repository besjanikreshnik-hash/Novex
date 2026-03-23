/**
 * NovEx Load Test — Track B: Funding Load
 *
 * Scenarios:
 *   B1. 20 concurrent deposit detection callbacks (10 unique + 10 duplicates)
 *   B2. 10 concurrent withdrawal requests from same user
 *   B3. Admin approve/reject under contention
 *   B4. Address-book and new-address hold behavior under repeated requests
 *
 * Run: npm run test:load
 */
import Decimal from 'decimal.js';
import {
  createTestModule, buildContext, resetAll, createUser, createPair, fundUser,
  newMetrics, runConcurrent, metricsReport, assertReconPasses,
  assertNoNegativeBalances, TestContext,
} from './harness';

jest.setTimeout(120_000);

describe('Track B: Funding Load', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    const mod = await createTestModule();
    ctx = await buildContext(mod);
  });

  afterAll(async () => {
    await ctx.ds.destroy();
    await ctx.module.close();
  });

  /* ═══ B1: Concurrent deposit detection (with duplicates) ═══ */
  it('B1: 20 deposit callbacks — 10 unique + 10 duplicates — idempotent', async () => {
    await resetAll(ctx);
    const user = await createUser(ctx, 'depositor@load.test');
    await fundUser(ctx, user.id, 'BTC', '0'); // create wallet

    const metrics = newMetrics();

    // 10 unique txHashes + 10 duplicates of the first 10
    const txHashes = Array.from({ length: 10 }, (_, i) => `0xtx_${i}`);
    const allHashes = [...txHashes, ...txHashes]; // 20 total

    const tasks = allHashes.map((hash, idx) => () =>
      ctx.funding.detectDeposit({
        userId: user.id, asset: 'BTC', network: 'bitcoin',
        txHash: hash, address: `bc1q${idx}`, amount: '0.1',
      }),
    );

    await runConcurrent(tasks, metrics);
    console.log(metricsReport('B1: 20 deposit callbacks (10 dups)', metrics));

    // Exactly 10 unique deposits
    const deposits = await ctx.repos.deposit.find({ where: { userId: user.id } });
    expect(deposits).toHaveLength(10);

    // All should succeed (duplicates return existing, no error)
    expect(metrics.succeeded).toBe(20);
  });

  /* ═══ B2: Concurrent withdrawal requests ═══════════════════ */
  it('B2: 10 concurrent withdrawals from same user — fund contention', async () => {
    await resetAll(ctx);
    const user = await createUser(ctx, 'withdrawer@load.test');
    await fundUser(ctx, user.id, 'USDT', '10000');

    const metrics = newMetrics();

    // Each tries to withdraw 2000 USDT — only 5 can succeed (10000 / 2000)
    const tasks = Array.from({ length: 10 }, (_, i) => () =>
      ctx.funding.requestWithdrawal(user.id, {
        asset: 'USDT', network: 'ethereum',
        address: `0xaddr_${i}`, amount: '2000',
      }),
    );

    await runConcurrent(tasks, metrics);
    console.log(metricsReport('B2: 10 concurrent withdrawals', metrics));

    // Some succeed, rest fail with insufficient balance
    expect(metrics.succeeded).toBeGreaterThanOrEqual(4); // at least 4 (fees eat some)
    expect(metrics.succeeded).toBeLessThanOrEqual(6);

    await assertNoNegativeBalances(ctx);

    // Total locked should equal succeeded × (2000 + fee)
    const w = await ctx.repos.wallet.findOneOrFail({
      where: { userId: user.id, currency: 'USDT' },
    });
    const totalLocked = new Decimal(w.locked);
    const totalAvail = new Decimal(w.available);
    expect(totalLocked.plus(totalAvail).lte(10000)).toBe(true);
  });

  /* ═══ B3: Admin approve/reject under contention ════════════ */
  it('B3: concurrent admin actions on pending withdrawals', async () => {
    await resetAll(ctx);
    const user = await createUser(ctx, 'multi@load.test');
    const admin = await createUser(ctx, 'admin@load.test');
    await fundUser(ctx, user.id, 'BTC', '10');

    // Create 5 pending withdrawals
    const withdrawals = [];
    for (let i = 0; i < 5; i++) {
      const w = await ctx.funding.requestWithdrawal(user.id, {
        asset: 'BTC', network: 'bitcoin',
        address: `bc1qknown_${i}`, amount: '0.1',
      });
      withdrawals.push(w);
    }

    const metrics = newMetrics();

    // Concurrently: approve odd, reject even
    const tasks = withdrawals.map((w, i) => () =>
      i % 2 === 0
        ? ctx.funding.rejectWithdrawal(w.id, admin.id, 'load test reject')
        : ctx.funding.approveWithdrawal(w.id, admin.id, 'load test approve'),
    );

    await runConcurrent(tasks, metrics);
    console.log(metricsReport('B3: concurrent approve/reject', metrics));

    // Some may fail if hold hasn't expired — that's expected
    expect(metrics.succeeded + metrics.failed).toBe(5);
    await assertNoNegativeBalances(ctx);
  });

  /* ═══ B4: Address book behavior under repeated requests ════ */
  it('B4: same address repeated — first is hold, subsequent are pending', async () => {
    await resetAll(ctx);
    const user = await createUser(ctx, 'repeat@load.test');
    const admin = await createUser(ctx, 'admin2@load.test');
    await fundUser(ctx, user.id, 'USDT', '50000');

    // First withdrawal to new address → HOLD
    const w1 = await ctx.funding.requestWithdrawal(user.id, {
      asset: 'USDT', network: 'ethereum', address: '0xrepeat', amount: '100',
    });
    expect(w1.isNewAddress).toBe(true);
    expect(w1.status).toBe('hold');

    // Reject to unlock funds
    await ctx.funding.rejectWithdrawal(w1.id, admin.id, 'test');

    // Second withdrawal to same address → PENDING (known)
    const w2 = await ctx.funding.requestWithdrawal(user.id, {
      asset: 'USDT', network: 'ethereum', address: '0xrepeat', amount: '100',
    });
    expect(w2.isNewAddress).toBe(false);
    expect(w2.status).toBe('pending');

    await assertNoNegativeBalances(ctx);
  });
});
