# NovEx — Security Review Package

*Prepared for independent security auditor. Version 1.0.*

---

## 1. Architecture Overview

```
                         ┌─────────────────┐
          Internet       │   CloudFront     │
         ─────────▶      │   (CDN + WAF)    │
                         └────────┬────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
              ┌─────▼────┐ ┌─────▼────┐ ┌─────▼────┐
              │ Web App  │ │ Mobile   │ │ Extension│
              │ Next.js  │ │ RN/Expo  │ │ Chrome   │
              └─────┬────┘ └─────┬────┘ └─────┬────┘
                    └─────────────┼─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   NestJS Backend           │
                    │   Port 3000                │
                    │                            │
                    │   REST API: /api/v1/*      │
                    │   WebSocket: /ws/market    │
                    │   Metrics: /metrics        │
                    │   Webhooks: /webhooks/*    │
                    └─────┬──────┬──────┬───────┘
                          │      │      │
                    ┌─────▼──┐ ┌─▼───┐ ┌▼──────┐
                    │Postgres│ │Redis│ │Kafka  │
                    │  :5432 │ │:6379│ │:9092  │
                    └────────┘ └─────┘ └───────┘
```

**Technology stack:** NestJS 10.3 / TypeScript / TypeORM / PostgreSQL 16 / Redis 7 / Kafka / Socket.IO

## 2. Authentication & Session Model

| Property | Value |
|----------|-------|
| Algorithm | HS256 (symmetric HMAC, @nestjs/jwt default) |
| Access token lifetime | 15 minutes |
| Refresh token lifetime | 7 days |
| Secret source | `JWT_SECRET` env var (default: `change-me`) |
| Token storage (web) | `localStorage` (access + refresh) |
| Token storage (mobile) | `expo-secure-store` |
| Refresh mechanism | `POST /auth/refresh` with JWT guard |
| Refresh token storage (server) | bcrypt hash in `users.refresh_token_hash` |
| Refresh token rotation | Yes — new pair on each refresh, old invalidated |
| Reuse detection | If refresh hash doesn't match, all sessions revoked |
| Password hashing | bcryptjs, 12 salt rounds |
| 2FA | TOTP interface defined, not yet enforced on sensitive ops |
| Passkeys/WebAuthn | Interface defined, not yet integrated |
| Session concurrency | No explicit limit (multiple devices allowed) |

### Token Flow

```
Register/Login → { accessToken (15m), refreshToken (7d) }
  │
  ├── Access token: sent as Authorization: Bearer header
  ├── Refresh token: stored client-side, bcrypt-hashed server-side
  │
  ├── On 401 → client calls POST /auth/refresh
  │   └── Server compares refreshToken against stored hash
  │       ├── Match → new token pair issued, old hash replaced
  │       └── Mismatch → all sessions revoked (reuse detection)
  │
  └── On logout → POST /auth/logout → refresh hash nullified
```

## 3. Order & Settlement Flow

```
Client → POST /orders { symbol, side, type, price, quantity }
  │
  ├── Guards: JwtAuth → AccountStatus → KycTier(1) → RateLimit
  ├── Optional: X-Idempotency-Key header
  │
  ├── Validate: pair active, price > 0, qty >= minQty, notional >= minNotional
  ├── Lock funds: lockFunds() with @VersionColumn optimistic locking (3 retries)
  ├── Persist order (status: OPEN)
  │
  ├── Submit to in-memory matching engine
  │   ├── STP check (cancel_taker / cancel_maker / none)
  │   ├── Price-time priority matching
  │   ├── Market orders: skip price check, never rest on book
  │   └── Returns MatchResult[] + StpEvent[]
  │
  ├── processMatches() — single DB transaction:
  │   ├── Create Trade record (gross amounts, explicit fee fields)
  │   ├── Update maker order (filledQuantity, status)
  │   ├── Update taker order (filledQuantity, status)
  │   ├── Buyer: debit quote locked → credit base available (net of fee)
  │   ├── Seller: debit base locked → credit quote available (net of fee)
  │   ├── Credit buyer fee to treasury (base asset)
  │   ├── Credit seller fee to treasury (quote asset)
  │   └── Create fee_ledger entries
  │
  └── Emit WebSocket events (order, fill, balance)
```

**Critical invariant:** All settlement operations are inside a single `dataSource.transaction()`. If any step fails, everything rolls back.

## 4. Funding Flow

### Deposits

```
Blockchain monitor detects tx → detectDeposit(txHash) [idempotent]
  → status: PENDING
  → updateConfirmations() on each new block
  → When confirmations >= threshold:
    → creditDeposit() in transaction:
      → wallet.available += amount
      → deposit.status = CREDITED
```

Confirmation thresholds: BTC=3, ETH=12, TRON=20, BSC=15.

### Withdrawals

```
User requests → status: PENDING or HOLD (new address → 24h hold)
  → Admin approves (different admin from user)
    → status: APPROVED
  → Different admin processes (maker-checker enforced)
    → Custody pipeline: createIntent → sign → broadcast → settle
    → status: COMPLETED
  → OR: Admin rejects → funds unlocked → status: REJECTED
  → OR: Broadcast fails → status: FAILED → admin recovers
```

## 5. WebSocket Authentication

| Channel Type | Auth Required | Room Pattern |
|---|---|---|
| Public: ticker | No | `{symbol}:ticker` |
| Public: trades | No | `{symbol}:trades` |
| Public: orderbook | No | `{symbol}:orderbook` |
| Private: account | Yes (JWT) | `user:{userId}` |

**Auth methods:**
1. Token in Socket.IO handshake `auth.token`
2. `Authorization: Bearer` header
3. Post-connect `authenticate` message

**Verification:** `JwtService.verify()` with same secret as REST API.

## 6. Admin / RBAC Model

### Role Hierarchy

```
ADMIN (5) → TREASURY (4) → OPS (3) → COMPLIANCE (2) → SUPPORT (1) → USER (0)
```

Higher roles inherit all lower-role permissions.

### Permission Matrix

| Action | Minimum Role | Maker-Checker |
|--------|-------------|:---:|
| Trade | USER + KYC Tier 1 | No |
| Withdraw | USER + KYC Tier 1 | No |
| View admin dashboards | SUPPORT | No |
| KYC review | COMPLIANCE | No |
| KYC manual override | COMPLIANCE | Yes (governance) |
| Trading pair halt/unhalt | OPS | Yes (governance) |
| Fee changes | OPS | Yes (governance) |
| Withdrawal approval | TREASURY | No* |
| Withdrawal processing | TREASURY | Yes (different from approver) |
| Emergency governance | ADMIN | No (post-review required) |
| System config | ADMIN | Yes (governance) |

\* Self-approval of own withdrawal prohibited.

## 7. Secrets & Environment Inventory

| Secret | Storage | Rotation |
|--------|---------|----------|
| JWT_SECRET | Env var / Secrets Manager | Manual (recommended: 90 days) |
| DATABASE_PASSWORD | Env var / Secrets Manager | RDS auto-rotation supported |
| REDIS_PASSWORD | Env var | Manual |
| SUMSUB_APP_TOKEN | Env var | Per vendor |
| SUMSUB_SECRET_KEY | Env var | Per vendor |
| SUMSUB_WEBHOOK_SECRET | Env var | Per vendor |
| ALCHEMY_API_KEY | Env var | Per vendor |
| Kafka credentials | Env var (MSK IAM in prod) | Automatic |

**Finding:** Default JWT_SECRET is `change-me`. Must be overridden in production.

## 8. Rate Limiting & Abuse Controls

| Endpoint | Scope | Window | Limit |
|----------|-------|--------|-------|
| All (default) | Per-IP | 60s | 100 |
| Login | Per-IP | 60s | 5 |
| Registration | Per-IP | 3600s | 3 |
| Place order | Per-user | 10s | 10 |
| Cancel order | Per-user | 10s | 20 |
| WebSocket connect | Per-IP | — | 5 concurrent |
| WebSocket messages | Per-connection | 60s | 100 |
| WebSocket subscribes | Per-connection | 60s | 50 |

**429 response format:** `{ statusCode: 429, retryAfter: N }` + `Retry-After` header.

## 9. Reconciliation & DR

### Reconciliation (7 invariant checks, run on demand)

1. No negative available balances
2. No negative locked balances
3. fee_ledger sum = treasury wallet balance (per asset)
4. Every trade has fee_ledger entries
5. No order overfills (filledQty <= quantity)
6. Trade gross_quote = price x gross_base
7. Trade-derived fee totals = treasury balance

### DR Targets

| Metric | Target |
|--------|--------|
| RPO | 5 minutes (RDS PITR) |
| RTO | 30 minutes |
| DR test frequency | Monthly |
| Backup retention | 30 days |

### Post-Restore Validation

11 SQL-level integrity checks executed before promoting a restored database.
