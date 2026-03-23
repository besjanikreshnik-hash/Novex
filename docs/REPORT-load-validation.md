# NovEx — Load & Failure-Mode Validation Report

## Test Suite Overview

Four tracks, 20 test scenarios, every scenario followed by reconciliation assertion.

```
Track A: Trading Load       — 5 scenarios
Track B: Funding Load       — 4 scenarios
Track C: WebSocket Load     — 5 scenarios
Track D: Failure Modes      — 5 scenarios
Total:                        19 scenarios + reconciliation after each
```

### Run Commands

```bash
npm run test:load              # All tracks (requires PostgreSQL)
npm run test:load:trading      # Track A only
npm run test:load:funding      # Track B only
npm run test:load:ws           # Track C only
npm run test:load:failures     # Track D only
```

## Track A: Trading Load

| Scenario | Config | Key Metric | Pass Criteria |
|----------|--------|------------|---------------|
| A1: 20 concurrent limit orders | 10 buyers + 10 sellers | All succeed | 20/20 succeed, recon passes |
| A2: 10 market orders vs thin book | 3 levels, 1.5 BTC total, 10 buyers × 0.2 BTC | Partial fills | No negative balances, no duplicate fees |
| A3: 10 market orders vs deep book | 20 levels, 20 BTC total, 10 buyers × 1.5 BTC | Multi-level sweep | All succeed, recon passes |
| A4: Rapid cancel/replace | 5 users × 10 place+cancel cycles | Funds restored | All locked = 0 after cancel, recon passes |
| A5: 5 duplicate submits | Same user, same payload, no idempotency key | 5 independent orders | 5 orders created, correct lock |

### Expected Bottlenecks

- **Matching engine serialization**: The in-memory engine is single-threaded. Under heavy concurrent load, requests queue on the event loop. This is the primary throughput limiter.
- **Wallet optimistic locking**: Same-user concurrent orders cause `@VersionColumn` conflicts. The `withOptimisticRetry` helper handles this (3 retries with jitter).
- **DB transaction contention**: Settlement runs in a transaction with multiple wallet updates. Under heavy load, PostgreSQL row locks can cause wait times.

### Tuning Recommendations

1. **Batch order submission**: Client-side debounce of < 50ms between orders from the same user
2. **Connection pooling**: Ensure PgBouncer in transaction mode with pool_size ≥ 20
3. **Matching engine extraction**: For > 1000 orders/sec, extract to a dedicated Rust/Go service with lock-free data structures

## Track B: Funding Load

| Scenario | Config | Key Metric | Pass Criteria |
|----------|--------|------------|---------------|
| B1: 20 deposit callbacks (10 dups) | 10 unique + 10 duplicate txHash | Idempotency | Exactly 10 deposits, 20 succeed |
| B2: 10 concurrent withdrawals | Same user, 10K USDT, 2K each | Fund contention | 4-5 succeed, rest rejected cleanly |
| B3: Admin approve/reject | 5 pending withdrawals, concurrent actions | State transitions | No double-unlock, no negative balances |
| B4: Address book repeated | Same address twice | Hold behavior | First: hold, second: pending |

### Expected Bottlenecks

- **Withdrawal fund locking**: Same wallet as trading — optimistic lock contention
- **Deposit crediting race**: Multiple confirmation callbacks for the same deposit. Guarded by status check (already-credited returns early).

### Tuning Recommendations

1. **Deposit crediting queue**: Use a Kafka consumer with per-txHash partitioning to serialize confirmation updates per deposit
2. **Withdrawal processing worker**: Separate from the API server, processes one withdrawal at a time with database advisory locks

## Track C: WebSocket Load

| Scenario | Config | Key Metric | Pass Criteria |
|----------|--------|------------|---------------|
| C1: Connection limits | 6 connections from same IP | 5 allowed, 6th rejected | Correct |
| C2: Message burst | 120 messages in 1 minute | 100 allowed, 20 rejected | Correct |
| C3: Subscribe burst | 60 subscribes in 1 minute | 50 allowed, 10 rejected | Correct |
| C4: Sequence dedup | 1000+ events with duplicates and gaps | All deduped correctly | Correct |
| C5: Room independence | 100 rooms × 50 events | No cross-contamination | Correct |

### Expected Bottlenecks

- **Memory**: Each Socket.IO connection consumes ~50KB. At 10,000 connections: ~500MB. Plan for 2GB memory headroom.
- **Broadcast fan-out**: Broadcasting to 10,000 subscribers on a popular pair (BTC_USDT) can cause CPU spikes. Socket.IO's room implementation is O(N) per emit.

### Tuning Recommendations

1. **Redis adapter**: Use `@socket.io/redis-adapter` for multi-process scaling
2. **Binary protocol**: Switch from JSON to MessagePack for 30-50% bandwidth reduction
3. **Snapshot compression**: Send orderbook deltas instead of full snapshots after the initial subscribe

## Track D: Failure Modes

| Scenario | Config | Key Metric | Pass Criteria |
|----------|--------|------------|---------------|
| D1: Optimistic lock contention | 10 orders, 1 user | Retry success | All 10 succeed, correct lock total |
| D2: Balance race | 20 orders, 50K USDT (1 can fill) | Clean rejection | Exactly 1 succeeds, 19 fail, no negative |
| D3: Settlement atomicity | 1 matching trade | All-or-nothing | 1 trade, 2 fees, zero-sum conserved |
| D4: Deposit confirmation race | 10 concurrent confirmations | Credited once | Balance = 1 BTC (not 10) |
| D5: Double-reject race | 5 concurrent rejects | Unlocked once | Locked = 0, available = original |

### Critical Findings

1. **D2 (Balance race)**: The optimistic locking ensures at most 1 order locks the full balance. The remaining 19 fail with `Insufficient balance`. This is correct behavior — no funds are ever over-allocated.

2. **D4 (Deposit race)**: The `if (status === CREDITED) return` early exit in `updateConfirmations()` prevents double-crediting. Under high concurrency, one call wins the race to `CONFIRMING → CREDITED`, all others see `CREDITED` and return idempotently.

3. **D5 (Double-reject race)**: The status check in `rejectWithdrawal()` prevents double-unlock. Only the first concurrent reject transitions from `PENDING/HOLD` to `REJECTED`. The rest fail with `Cannot reject in status rejected`.

## Reconciliation After Stress

Every scenario calls `assertReconPasses(ctx, label)` after execution. This runs the full reconciliation suite:

- No negative balances
- Fee ledger ↔ treasury balance match
- Every trade has fee entries
- No order overfills
- Trade quote = price × base
- Trade-derived fees = treasury balance

If any invariant fails, the test fails with the specific mismatch details.

## Beta Readiness Pass/Fail Thresholds

| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| A1: Concurrent limit orders | 20/20 succeed | Basic correctness |
| A4: Cancel/replace funds released | All locked = 0 | No fund leakage |
| B1: Deposit idempotency | Exactly N unique | No double-credit |
| B2: Withdrawal fund contention | No negative balances | No over-allocation |
| D1: OLP retry success rate | 100% | Retry system works |
| D2: Balance race — single winner | Exactly 1 succeeds | No over-spend |
| D4: Deposit race — single credit | Balance = exact amount | No double-credit |
| D5: Reject race — single unlock | Locked = 0, available = original | No fund leak |
| All scenarios: Reconciliation | 0 mismatches | Accounting integrity |
| Order placement p95 latency | < 200ms | UX acceptable |
| Market order p95 latency | < 500ms | Multi-level sweep acceptable |

### Verdict

If all 19 scenarios pass with zero reconciliation mismatches and latency is within thresholds, the system is **beta-ready** for internal testing with real users and seeded funds.

### Known Limitations

1. **Matching engine is in-process**: Throughput ceiling of ~5,000 orders/sec on a single node. Acceptable for beta, needs extraction for scale.
2. **Deposit monitoring is mock**: Real blockchain integration (Alchemy/Infura) needed before mainnet deposits.
3. **Withdrawal execution is mock**: Real on-chain signing (HSM/KMS) needed before mainnet withdrawals.
4. **WebSocket tests are unit-level**: Socket.IO connection-level load testing requires a running server with tools like artillery or k6.
5. **No Redis/Kafka failure injection**: These tests don't simulate infrastructure failures. Add chaos engineering tests before production launch.
