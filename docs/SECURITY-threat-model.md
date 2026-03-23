# NovEx — Threat Model

## Trust Boundaries

```
┌──────────────────────────────────────────────────────────────┐
│  UNTRUSTED: Internet                                         │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Web Browser  │  │ Mobile App   │  │ KYC/Blockchain   │  │
│  │ (user)       │  │ (user)       │  │ Vendor Webhooks  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                    │             │
├─────────┼─────────────────┼────────────────────┼─────────────┤
│  BOUNDARY: WAF / Load Balancer / TLS termination             │
├─────────┼─────────────────┼────────────────────┼─────────────┤
│                                                              │
│  ┌──────▼─────────────────▼────────────────────▼─────────┐  │
│  │  SEMI-TRUSTED: NestJS Backend                          │  │
│  │  - REST API (authenticated)                            │  │
│  │  - WebSocket (mixed auth/public)                       │  │
│  │  - Webhook receivers (signature-verified)              │  │
│  └──────┬─────────────────┬────────────────────┬─────────┘  │
│         │                 │                    │             │
├─────────┼─────────────────┼────────────────────┼─────────────┤
│  BOUNDARY: Private subnet / Security groups                  │
├─────────┼─────────────────┼────────────────────┼─────────────┤
│                                                              │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────────▼─────────┐  │
│  │  TRUSTED:   │  │  TRUSTED:   │  │  TRUSTED:          │  │
│  │  PostgreSQL │  │  Redis      │  │  Kafka             │  │
│  └─────────────┘  └─────────────┘  └────────────────────┘  │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  TRUSTED: Custody/HSM (private keys, signing)           │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## Prioritized Threats

### P0 — Critical (fund loss or systemic compromise)

| ID | Threat | Attack Vector | Current Mitigation | Residual Risk |
|---|---|---|---|---|
| T1 | **JWT secret compromise** | Env leak, log exposure, weak default | Env var isolation, but default is `change-me` | **HIGH** — must enforce strong secret in prod |
| T2 | **Double-spend via settlement race** | Concurrent order submission draining same balance | @VersionColumn optimistic locking + 3 retries | LOW — tested under concurrency load |
| T3 | **Fee manipulation** | Modify fee amounts between match and settle | Fees calculated atomically in settlement transaction | LOW |
| T4 | **Withdrawal fund theft** | Compromise admin account, approve + process own withdrawal | Maker-checker (approve ≠ process), self-approval blocked, RBAC | MEDIUM — depends on admin credential security |
| T5 | **Hot wallet key extraction** | Application server compromise | Custody abstraction — keys in HSM/MPC, never in app memory | LOW (if HSM deployed), HIGH (if hot wallet in KMS) |
| T6 | **Double deposit credit** | Replay deposit detection callback | Idempotent on txHash (unique constraint), status check before credit | LOW — tested |
| T7 | **Negative balance exploit** | Race condition in lock/unlock | Optimistic locking + reconciliation checks + load tests | LOW |

### P1 — High (significant financial or operational impact)

| ID | Threat | Attack Vector | Current Mitigation | Residual Risk |
|---|---|---|---|---|
| T8 | **Token replay after logout** | Intercept access token, use after logout | 15-minute access token expiry, no server-side revocation list | MEDIUM — access token valid until expiry |
| T9 | **Webhook forgery (KYC)** | Forge Sumsub webhook to grant KYC approval | HMAC signature verification | LOW (if secret strong), HIGH (if mock provider in prod) |
| T10 | **Order book manipulation** | Flood with orders to move price, then cancel | Per-user rate limits (10 orders/10s), STP | MEDIUM — sophisticated wash trading still possible |
| T11 | **Admin privilege escalation** | Regular user modifies request to add admin role | RBAC guard checks `user.role` from JWT, role set at registration | LOW — unless JWT signing key compromised |
| T12 | **Database SSL bypass** | MITM on database connection | SSL disabled by default, `rejectUnauthorized: false` when enabled | **HIGH** in prod — must enable SSL with proper CA |

### P2 — Medium (limited impact, exploitable under specific conditions)

| ID | Threat | Attack Vector | Current Mitigation | Residual Risk |
|---|---|---|---|---|
| T13 | **Client-side token theft (XSS)** | XSS in web app reads localStorage | Helmet CSP headers, React auto-escaping | MEDIUM — localStorage is XSS-accessible |
| T14 | **Rate limit bypass** | Rotate IPs (botnet) | Per-user limits on auth'd endpoints, per-IP on anon | MEDIUM — IP rotation defeats per-IP limits |
| T15 | **WebSocket flood** | Open many connections, subscribe to all channels | 5 connections/IP, 50 subscribes/min, 100 messages/min | LOW |
| T16 | **Matching engine DOS** | Submit max-quantity market orders to exhaust book | Min notional check, rate limiting | LOW |
| T17 | **Audit log tampering** | Compromised DB admin deletes audit records | Kafka replication (separate system), DB audit table has no DELETE API | MEDIUM — DBA can still modify |

### P3 — Low (informational, defense-in-depth)

| ID | Threat | Attack Vector | Current Mitigation | Residual Risk |
|---|---|---|---|---|
| T18 | **User enumeration** | Different error messages for valid/invalid emails on login | Both return "Invalid credentials" | LOW |
| T19 | **Timing attack on password** | Measure response time to determine password validity | bcrypt is constant-time | LOW |
| T20 | **CORS misconfiguration (dev)** | Development mode allows all origins | Production restricts to `https://novex.io` | LOW (if env correct) |

## Attack Surface Inventory

### External-Facing Endpoints (Internet-accessible)

| Surface | Auth | Rate Limited | Notes |
|---|---|---|---|
| `POST /auth/register` | None | 3/hour per IP | User creation |
| `POST /auth/login` | None | 5/min per IP | Credential check |
| `GET /market/*` | None | 100/min per IP | Public market data |
| `POST /webhooks/kyc` | Signature | None | KYC vendor callback |
| `GET /metrics` | None | None | Prometheus scrape — **restrict in prod** |
| `wss://host/ws/market` | Optional JWT | 5 conn/IP | WebSocket |

### Authenticated Endpoints (JWT required)

| Surface | Additional Guards | Notes |
|---|---|---|
| `POST /orders` | KycTier(1) + AccountStatus + RateLimit(10/10s) | Trading |
| `DELETE /orders/:id` | KycTier(1) + AccountStatus + RateLimit(20/10s) | Cancel |
| `GET /wallets/balances` | JwtAuth | Balance read |
| `POST /withdrawals` | KycTier(1) + AccountStatus | Fund withdrawal |

### Admin Endpoints (Role-restricted)

| Surface | Required Role | Maker-Checker |
|---|---|---|
| `POST /admin/withdrawals/:id/approve` | ADMIN | Self-approval blocked |
| `POST /admin/withdrawals/:id/process` | ADMIN | Approver ≠ processor |
| `POST /admin/governance/*` | OPS/COMPLIANCE/ADMIN | Proposer ≠ approver |
| `POST /admin/governance/requests/:id/emergency` | ADMIN | Bypasses, flagged |
| `GET /admin/metrics` | None (**to fix**) | N/A |

### Data Stores

| Store | Network Access | Encryption |
|---|---|---|
| PostgreSQL | Private subnet only | At-rest: RDS encryption. In-transit: SSL optional |
| Redis | Private subnet only | At-rest: ElastiCache encryption. In-transit: optional |
| Kafka | Private subnet only | At-rest: MSK encryption. In-transit: optional |
| S3 (KYC docs) | IAM + bucket policy | SSE-KMS |
