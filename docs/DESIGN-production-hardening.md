# NovEx — Production Hardening: Rate Limiting, Observability, Funding, and KYC Gating

## 1. Rate Limiting & Abuse Controls

### Architecture

Five named throttler buckets applied at different granularities:

| Bucket | Scope | Window | Limit | Applied To |
|--------|-------|--------|-------|------------|
| `default` | Per-IP | 60s | 100 | All endpoints (baseline) |
| `auth` | Per-IP | 60s | 5 | POST /auth/login |
| `registration` | Per-IP | 3600s | 3 | POST /auth/register |
| `order-placement` | Per-user | 10s | 10 | POST /orders |
| `order-cancel` | Per-user | 10s | 20 | DELETE /orders/:id |

### WebSocket Limits

| Limit | Value | Enforcement |
|-------|-------|-------------|
| Connections per IP | 5 | Reject on connect |
| Subscribe events per minute | 50 | Disconnect on violation |
| Messages per minute | 100 | Disconnect on violation |

### 429 Response Format

```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again in 8 seconds.",
  "retryAfter": 8
}
```

Header: `Retry-After: 8`

### Frontend Handling

The web API client catches 429 responses and throws a typed `RateLimitError` with `retryAfterSeconds`. The UI can display a countdown or disable the submit button.

## 2. Observability & Alerting

### Metrics Catalog

| Metric | Type | Labels | Source |
|--------|------|--------|--------|
| `order_placement_count` | Counter | symbol, side, type | TradingService |
| `order_placement_latency_ms` | Histogram | — | MetricsInterceptor |
| `match_to_settlement_latency_ms` | Histogram | — | TradingService |
| `market_order_rejection_count` | Counter | reason | TradingService |
| `slippage_bound_rejection_count` | Counter | — | TradingService |
| `idempotency_replay_count` | Counter | — | IdempotencyService |
| `ws_reconnect_count` | Counter | — | MarketGateway |
| `reconciliation_mismatch_count` | Counter | type | ReconciliationService |
| `treasury_fee_collected` | Counter | asset | WalletsService |
| `cancel_failure_count` | Counter | reason | TradingService |
| `http_5xx_count` | Counter | endpoint | MetricsInterceptor |

### Alert Rules

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| Reconciliation mismatch | count > 0 | Critical | Page on-call, freeze trading |
| Duplicate fee_ledger | detected | Critical | Investigate settlement bug |
| 5xx on /orders | rate > 1% for 5min | High | Check logs, trading service health |
| WS disconnect spike | > 50/min | Warning | Check network, gateway health |
| Negative balance | any occurrence | Critical | Freeze affected user, investigate |
| Treasury/fee drift | fee_ledger ≠ treasury | High | Run reconciliation, fix manually |

### Endpoint

`GET /api/v1/admin/metrics` — Returns full snapshot of all counters and histograms.

## 3. Funding Lifecycle

### Deposit Flow

```
User requests address → getOrCreateDepositAddress()
  ↓
Blockchain monitor detects tx → detectDeposit(txHash)
  ↓ status: PENDING
Monitor tracks blocks → updateConfirmations(txHash, N)
  ↓ status: CONFIRMING
Confirmations ≥ threshold → creditDeposit()
  ↓ status: CREDITED
  ↓ wallet.available += amount
  ↓ emit balance.updated event
```

Confirmation thresholds: BTC=3, ETH=12, TRON=20, BSC=15.

### Withdrawal Flow

```
User requests withdrawal → requestWithdrawal()
  ├── Lock funds (amount + fee)
  ├── Check address book
  │   ├── Known address → status: PENDING
  │   └── New address → status: HOLD (24h)
  ↓
Admin reviews → approveWithdrawal() or rejectWithdrawal()
  ├── Approve → status: APPROVED
  │   ↓
  │   Worker executes → processWithdrawal()
  │   ├── Submit on-chain tx
  │   ├── Debit locked funds permanently
  │   ├── Credit withdrawal fee to treasury
  │   └── status: COMPLETED
  │
  └── Reject → Unlock funds, status: REJECTED

Failed withdrawal → recoverFailedWithdrawal()
  ↓ Unlock funds, status: REJECTED
```

### Withdrawal Fees (placeholder)

| Asset:Network | Fee |
|---------------|-----|
| BTC:bitcoin | 0.0001 BTC |
| ETH:ethereum | 0.001 ETH |
| USDT:ethereum | 5 USDT |
| USDT:tron | 1 USDT |
| SOL:solana | 0.01 SOL |

### API Endpoints

```
POST /deposit-address         — Generate deposit address (auth required)
GET  /deposits                — List user deposits
POST /withdrawals             — Request withdrawal (KYC required)
GET  /withdrawals             — List user withdrawals
GET  /admin/withdrawals/pending  — Admin: pending queue
POST /admin/withdrawals/:id/approve
POST /admin/withdrawals/:id/reject
POST /admin/withdrawals/:id/process
POST /admin/withdrawals/:id/recover
```

## 4. KYC / Risk Permission Gating

### Guard Stack

Every protected endpoint passes through a layered guard stack:

```
Request → JwtAuthGuard → AccountStatusGuard → KycTierGuard → [RateLimitGuard] → Handler
```

| Guard | Purpose | Rejection |
|-------|---------|-----------|
| `JwtAuthGuard` | Valid JWT token | 401 Unauthorized |
| `AccountStatusGuard` | User.isActive = true | 403 "Account suspended" |
| `KycTierGuard` | User meets minimum tier | 403 "KYC verification required" |
| `RateLimitGuard` | Within rate limits | 429 Too Many Requests |

### Tier-Based Access

| Feature | Tier 0 (None) | Tier 1 (Verified) | Tier 2 (Enhanced) |
|---------|:---:|:---:|:---:|
| View markets | Yes | Yes | Yes |
| View balances | Yes | Yes | Yes |
| Place orders | No | Yes | Yes |
| Cancel orders | No | Yes | Yes |
| Deposit | No | Yes | Yes |
| Withdraw | No | Yes ($5K/day) | Yes ($50K/day) |

### Withdrawal Limits

The `WithdrawalLimitsGuard` checks 24h rolling withdrawal volume against tier-based limits:

| Tier | Daily Limit |
|------|-------------|
| Unverified | $0 (blocked) |
| Verified | $5,000 |
| Enhanced | $50,000 |

### How Guards Are Applied

Trading controller:
```typescript
@UseGuards(JwtAuthGuard, AccountStatusGuard, KycTierGuard, RateLimitGuard)
@RequireKycTier(1) // All trading requires basic KYC
```

Funding controller (withdrawal):
```typescript
@UseGuards(JwtAuthGuard, AccountStatusGuard, KycTierGuard)
@RequireKycTier(1) // Withdrawals require KYC
```

## Test Commands

```bash
npm run test:funding        # Deposit/withdrawal lifecycle
npm run test:engine         # Matching engine (includes market orders)
npm run test:recon          # Reconciliation invariants
npm run test:concurrency    # Idempotency and concurrency
npm run test:market         # Market order specifics
```
