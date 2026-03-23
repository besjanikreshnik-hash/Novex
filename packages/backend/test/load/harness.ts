/**
 * NovEx — Load Test Harness
 *
 * Shared utilities for creating test contexts, users, funding,
 * running concurrent operations, and collecting metrics.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Repository, DataSource } from 'typeorm';
import Decimal from 'decimal.js';

import { TradingService } from '../../src/modules/trading/trading.service';
import { MatchingEngineService } from '../../src/modules/trading/matching-engine.service';
import { WalletsService } from '../../src/modules/wallets/wallets.service';
import { FundingService } from '../../src/modules/funding/funding.service';
import { ReconciliationService } from '../../src/modules/reconciliation/reconciliation.service';
import { IdempotencyService } from '../../src/common/idempotency/idempotency.service';

import { Order, OrderSide, OrderType, OrderStatus } from '../../src/modules/trading/entities/order.entity';
import { Trade } from '../../src/modules/trading/entities/trade.entity';
import { TradingPair } from '../../src/modules/trading/entities/trading-pair.entity';
import { FeeLedger } from '../../src/modules/trading/entities/fee-ledger.entity';
import { Wallet } from '../../src/modules/wallets/wallet.entity';
import { User, UserRole, KycStatus } from '../../src/modules/users/user.entity';
import { AuditLog } from '../../src/modules/audit/audit.entity';
import { IdempotencyKey } from '../../src/common/idempotency/idempotency-key.entity';
import { ReconciliationRun } from '../../src/modules/reconciliation/entities/reconciliation-run.entity';
import { ReconciliationMismatch } from '../../src/modules/reconciliation/entities/reconciliation-mismatch.entity';
import { Deposit } from '../../src/modules/funding/entities/deposit.entity';
import { Withdrawal } from '../../src/modules/funding/entities/withdrawal.entity';
import { DepositAddress } from '../../src/modules/funding/entities/deposit-address.entity';
import { WithdrawalAddressBook } from '../../src/modules/funding/entities/withdrawal-address-book.entity';

export const ALL_ENTITIES = [
  User, Wallet, Order, Trade, TradingPair, FeeLedger, AuditLog,
  IdempotencyKey, ReconciliationRun, ReconciliationMismatch,
  Deposit, Withdrawal, DepositAddress, WithdrawalAddressBook,
];

const PLATFORM = WalletsService.PLATFORM_FEE_ACCOUNT;

/* ─── Module setup ───────────────────────────────────── */

export async function createTestModule(): Promise<TestingModule> {
  return Test.createTestingModule({
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
        entities: ALL_ENTITIES,
        synchronize: true,
        dropSchema: true,
      }),
      TypeOrmModule.forFeature(ALL_ENTITIES),
    ],
    providers: [
      TradingService, MatchingEngineService, WalletsService,
      FundingService, ReconciliationService, IdempotencyService,
    ],
  }).compile();
}

/* ─── Context object ─────────────────────────────────── */

export interface TestContext {
  module: TestingModule;
  trading: TradingService;
  engine: MatchingEngineService;
  wallets: WalletsService;
  funding: FundingService;
  recon: ReconciliationService;
  ds: DataSource;
  repos: {
    user: Repository<User>;
    wallet: Repository<Wallet>;
    order: Repository<Order>;
    trade: Repository<Trade>;
    pair: Repository<TradingPair>;
    fee: Repository<FeeLedger>;
    deposit: Repository<Deposit>;
    withdrawal: Repository<Withdrawal>;
    idempotency: Repository<IdempotencyKey>;
    reconRun: Repository<ReconciliationRun>;
    reconMismatch: Repository<ReconciliationMismatch>;
  };
}

export async function buildContext(mod: TestingModule): Promise<TestContext> {
  return {
    module: mod,
    trading: mod.get(TradingService),
    engine: mod.get(MatchingEngineService),
    wallets: mod.get(WalletsService),
    funding: mod.get(FundingService),
    recon: mod.get(ReconciliationService),
    ds: mod.get(DataSource),
    repos: {
      user: mod.get(getRepositoryToken(User)),
      wallet: mod.get(getRepositoryToken(Wallet)),
      order: mod.get(getRepositoryToken(Order)),
      trade: mod.get(getRepositoryToken(Trade)),
      pair: mod.get(getRepositoryToken(TradingPair)),
      fee: mod.get(getRepositoryToken(FeeLedger)),
      deposit: mod.get(getRepositoryToken(Deposit)),
      withdrawal: mod.get(getRepositoryToken(Withdrawal)),
      idempotency: mod.get(getRepositoryToken(IdempotencyKey)),
      reconRun: mod.get(getRepositoryToken(ReconciliationRun)),
      reconMismatch: mod.get(getRepositoryToken(ReconciliationMismatch)),
    },
  };
}

/* ─── Data helpers ───────────────────────────────────── */

export async function resetAll(ctx: TestContext): Promise<void> {
  const { repos } = ctx;
  // Clear in dependency order
  await repos.reconMismatch.delete({});
  await repos.reconRun.delete({});
  await repos.idempotency.delete({});
  await repos.fee.delete({});
  await repos.trade.delete({});
  await repos.order.delete({});
  await repos.withdrawal.delete({});
  await repos.deposit.delete({});
  await repos.wallet.delete({});
  await repos.pair.delete({});
  await repos.user.delete({});
  (ctx.engine as any).books.clear();

  // Platform treasury user
  await repos.user.save(repos.user.create({
    id: PLATFORM, email: 'platform@novex.internal',
    passwordHash: 'n/a', role: UserRole.ADMIN, isActive: true,
  }));
}

export async function createUser(ctx: TestContext, email: string): Promise<User> {
  return ctx.repos.user.save(ctx.repos.user.create({
    email, passwordHash: '$2b$12$placeholder',
    role: UserRole.USER, kycStatus: KycStatus.VERIFIED, isActive: true,
  }));
}

export async function createPair(ctx: TestContext, overrides: Partial<TradingPair> = {}): Promise<TradingPair> {
  return ctx.repos.pair.save(ctx.repos.pair.create({
    symbol: 'BTC_USDT', baseCurrency: 'BTC', quoteCurrency: 'USDT',
    pricePrecision: 2, quantityPrecision: 8, minQuantity: '0.00001',
    makerFee: '0.001', takerFee: '0.002', isActive: true,
    stpMode: 'cancel_taker', maxQuantity: '0', minNotional: '1',
    ...overrides,
  }));
}

export async function fundUser(ctx: TestContext, userId: string, currency: string, amount: string): Promise<Wallet> {
  let w = await ctx.repos.wallet.findOne({ where: { userId, currency } });
  if (!w) w = ctx.repos.wallet.create({ userId, currency, available: amount, locked: '0' });
  else w.available = new Decimal(w.available).plus(amount).toFixed();
  return ctx.repos.wallet.save(w);
}

/* ─── Metrics collector ──────────────────────────────── */

export interface LoadMetrics {
  totalOps: number;
  succeeded: number;
  failed: number;
  errors: Map<string, number>;
  latencies: number[];
  startTime: number;
  endTime: number;
}

export function newMetrics(): LoadMetrics {
  return {
    totalOps: 0, succeeded: 0, failed: 0,
    errors: new Map(), latencies: [], startTime: Date.now(), endTime: 0,
  };
}

export function recordOp(m: LoadMetrics, latencyMs: number, error?: string): void {
  m.totalOps++;
  m.latencies.push(latencyMs);
  if (error) {
    m.failed++;
    m.errors.set(error, (m.errors.get(error) ?? 0) + 1);
  } else {
    m.succeeded++;
  }
}

export function finalizeMetrics(m: LoadMetrics): void {
  m.endTime = Date.now();
}

export function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export function metricsReport(label: string, m: LoadMetrics): string {
  const duration = m.endTime - m.startTime;
  const opsPerSec = m.totalOps / (duration / 1000);
  return [
    `\n═══ ${label} ═══`,
    `Total ops:    ${m.totalOps}`,
    `Succeeded:    ${m.succeeded}`,
    `Failed:       ${m.failed}`,
    `Duration:     ${duration}ms`,
    `Throughput:   ${opsPerSec.toFixed(1)} ops/s`,
    `Latency p50:  ${percentile(m.latencies, 50).toFixed(1)}ms`,
    `Latency p95:  ${percentile(m.latencies, 95).toFixed(1)}ms`,
    `Latency p99:  ${percentile(m.latencies, 99).toFixed(1)}ms`,
    m.errors.size > 0 ? `Errors: ${JSON.stringify(Object.fromEntries(m.errors))}` : '',
  ].filter(Boolean).join('\n');
}

/* ─── Concurrent runner ──────────────────────────────── */

export async function runConcurrent<T>(
  tasks: Array<() => Promise<T>>,
  metrics: LoadMetrics,
): Promise<T[]> {
  const results = await Promise.allSettled(
    tasks.map(async (task) => {
      const start = performance.now();
      try {
        const result = await task();
        recordOp(metrics, performance.now() - start);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message.slice(0, 60) : 'unknown';
        recordOp(metrics, performance.now() - start, msg);
        throw err;
      }
    }),
  );

  finalizeMetrics(metrics);
  return results
    .filter((r): r is PromiseFulfilledResult<T> => r.status === 'fulfilled')
    .map((r) => r.value);
}

/* ─── Reconciliation assertion ───────────────────────── */

export async function assertReconPasses(ctx: TestContext, label: string): Promise<void> {
  const run = await ctx.recon.executeRun(`load-test:${label}`);
  if (run.mismatchCount > 0) {
    const details = run.mismatches?.map(
      (m) => `  ${m.mismatchType}: ${m.description} (expected=${m.expectedValue}, actual=${m.actualValue})`,
    ).join('\n') ?? '';
    throw new Error(`Reconciliation FAILED after ${label}:\n${details}`);
  }
}

/* ─── Invariant checks ───────────────────────────────── */

export async function assertNoNegativeBalances(ctx: TestContext): Promise<void> {
  const wallets = await ctx.repos.wallet.find();
  for (const w of wallets) {
    if (new Decimal(w.available).lt(0)) {
      throw new Error(`Negative available: user=${w.userId} currency=${w.currency} available=${w.available}`);
    }
    if (new Decimal(w.locked).lt(0)) {
      throw new Error(`Negative locked: user=${w.userId} currency=${w.currency} locked=${w.locked}`);
    }
  }
}

export async function assertNoDuplicateTrades(ctx: TestContext): Promise<void> {
  const trades = await ctx.repos.trade.find();
  const ids = new Set(trades.map((t) => t.id));
  if (ids.size !== trades.length) {
    throw new Error(`Duplicate trade IDs detected: ${trades.length} trades, ${ids.size} unique`);
  }
}

export async function assertNoDuplicateFees(ctx: TestContext): Promise<void> {
  const fees = await ctx.repos.fee.find();
  // Each trade should have at most 2 fee entries (buyer + seller)
  const tradeFeeCounts = new Map<string, number>();
  for (const f of fees) {
    tradeFeeCounts.set(f.tradeId, (tradeFeeCounts.get(f.tradeId) ?? 0) + 1);
  }
  for (const [tradeId, count] of tradeFeeCounts) {
    if (count > 2) {
      throw new Error(`Trade ${tradeId} has ${count} fee entries (expected max 2)`);
    }
  }
}

export { OrderSide, OrderType, OrderStatus, PLATFORM };
