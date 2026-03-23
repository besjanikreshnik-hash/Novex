# NovEx — Idempotency & Concurrency Design

## For API Consumers

### Idempotency Keys

All mutating trading endpoints (`POST /orders`, `DELETE /orders/:id`) support an optional `X-Idempotency-Key` header.

```
POST /api/v1/orders
X-Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{ "symbol": "BTC_USDT", "side": "buy", "type": "limit", "price": "50000", "quantity": "1" }
```

#### Behavior

| Scenario | Response |
|----------|----------|
| First request with new key | Executes normally, caches result |
| Retry with same key + same payload | Returns cached result (same status, same body) |
| Same key + different payload | `422 Unprocessable Entity` |
| Same key + different user | `409 Conflict` |
| Key still processing (concurrent) | `409 Conflict` |
| Key omitted | No idempotency protection (each request creates a new order) |

#### Client Guidelines

1. **Generate a UUID v4** for each intended operation (not per HTTP request — per *intended* action).
2. **Reuse the same key** when retrying after a network failure or timeout.
3. **Never reuse a key** for a different operation — generate a fresh UUID.
4. Keys expire after **24 hours**.
5. The key is scoped to the authenticated user — one user cannot replay another's key.

#### Payload Matching

The server computes a SHA-256 hash of the request body (JSON keys sorted alphabetically). If a completed key is resubmitted with a different payload hash, the server returns `422` rather than silently executing a different operation.

### Error Handling for Retries

| HTTP Status | Meaning | Safe to Retry? |
|-------------|---------|----------------|
| `201` | Order placed | No (already done) |
| `200` | Order cancelled | No (already done) |
| `400` | Validation error (bad price, insufficient balance) | No (fix the request) |
| `409` | Idempotency conflict (in-flight or cross-user) | Wait briefly, then retry |
| `422` | Payload mismatch on reused key | No (use a new key) |
| `500` | Server error | Yes, retry with **same idempotency key** |
| Network timeout | Unknown result | Yes, retry with **same idempotency key** |

---

## For Operators

### Optimistic Locking & Retries

NovEx wallets use a `@VersionColumn` (optimistic locking). When two concurrent requests try to modify the same wallet row, one succeeds and the other gets an `OptimisticLockVersionMismatchError`.

The system handles this automatically:

```
lockFunds() / unlockFunds() → withOptimisticRetry()
  ├── Attempt 1: read wallet → modify → save
  │   └── OptimisticLockVersionMismatchError (concurrent write)
  ├── Attempt 2: re-read wallet → modify → save
  │   └── Success (fresh version)
  └── Max 3 retries with jittered backoff
```

**Structured log events:**

```json
{"event":"optimistic_retry_attempt","label":"lockFunds(user-123, USDT)","attempt":1,"maxRetries":3}
{"event":"optimistic_retry_succeeded","label":"lockFunds(user-123, USDT)","attempts":2}
```

If retries exhaust:
```json
{"event":"optimistic_retry_exhausted","label":"lockFunds(user-123, USDT)","attempts":4,"maxRetries":3}
```

**When this fires:** High contention on a single user's wallet. Usually means the same user is submitting orders faster than the DB can serialize their wallet updates. This is normal under heavy load but if it happens frequently, consider:
- Rate limiting per-user order submissions
- Sharding wallets by user

### Settlement Transaction Safety

Trade settlement runs inside `dataSource.transaction()`:

```
processMatches() transaction:
  ├── Create Trade record
  ├── Update maker Order (filledQuantity, status)
  ├── Update taker Order (filledQuantity, status)
  ├── settleTrade for buyer (debit quote locked, credit base available)
  ├── settleTrade for seller (debit base locked, credit quote available)
  ├── creditFee to treasury (buyer fee in base asset)
  ├── creditFee to treasury (seller fee in quote asset)
  ├── Create fee_ledger entry for buyer fee
  └── Create fee_ledger entry for seller fee
```

If any step fails, the **entire transaction rolls back**. This guarantees:
- No trade without balanced settlement
- No fee credit without trade
- No fee_ledger entry without treasury credit
- No partial order status update

### Idempotency Key Cleanup

Keys have an `expires_at` column (24h after creation). Schedule a cleanup job:

```sql
DELETE FROM idempotency_keys WHERE expires_at < NOW();
```

Run hourly via cron or Kubernetes CronJob.

### Monitoring Checklist

| Metric | Alert Threshold | What It Means |
|--------|-----------------|---------------|
| `optimistic_retry_attempt` rate | > 10/min per user | High contention on single wallet |
| `optimistic_retry_exhausted` count | Any occurrence | Order placement failed after max retries |
| `idempotency_keys` table size | > 100,000 rows | Cleanup job may not be running |
| Duplicate `fee_ledger` entries per trade | Any trade with > 2 | Settlement bug — escalate immediately |
| Negative wallet balance | Any occurrence | Critical — run reconciliation |

### Invariants Enforced

1. **Exactly 1 order per idempotency key** — `idempotency_keys.key` is the primary key
2. **Payload-locked keys** — `request_hash` prevents reuse with different params
3. **No double-unlock on cancel** — Second cancel throws "cannot be cancelled" (order already in CANCELLED status)
4. **No double-trade** — Matching engine is single-threaded; `processMatches` is atomic
5. **No double-fee** — Fee ledger writes are inside the same transaction as trade creation
6. **Zero-sum conservation** — Total of each asset across all wallets (including treasury) equals the sum of all deposits minus withdrawals
7. **No negative balances** — `lockFunds` checks `available >= amount` before deducting; settlement checks `locked >= debitAmount`

### Test Coverage

```bash
npm run test:concurrency   # 15 integration tests
```

| Test | Scenario |
|------|----------|
| TC1 | Same key + same payload → cached replay |
| TC2 | Different keys + same payload → 2 distinct orders |
| TC3 | Same key + different payload → 422 rejection |
| TC4 | 5 concurrent buyers vs 2 BTC resting → exactly 2 fill |
| TC5a | Double cancel → second fails gracefully |
| TC5b | Cancel with idempotency → replay returns cached, no double-unlock |
| TC6a | Insufficient balance → zero orders, zero trades, zero fees |
| TC6b | Released key → re-acquirable |
| TC7 | Zero-sum after trades (USDT + BTC conserved) |
| TC8 | Each trade has exactly 2 fee entries, no duplicates |
| TC9 | 6 concurrent mixed orders → no negative balances |
| TC10 | 10 rapid orders + cancel all → full balance restoration |
