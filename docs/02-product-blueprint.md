# NovEx — Product Blueprint

## 1. Product Philosophy

NovEx follows three design principles:

1. **Progressive Complexity** — Users start with a simple buy/sell interface. Advanced features (limit orders, charts, API) unlock as users gain experience or explicitly opt in.
2. **Security by Default** — Every action with financial impact requires multi-factor confirmation. Device trust is established at signup.
3. **Compliance as Architecture** — KYC, AML, and transaction monitoring are not bolted on but wired into the transaction pipeline.

## 2. User Journeys

### Journey A: First-Time Buyer
```
Landing Page → Sign Up (email + passkey) → KYC (ID upload) → Deposit (fiat on-ramp placeholder) →
Simple Buy Screen → Confirm Purchase → Portfolio View → Enable Price Alerts
```

### Journey B: Active Trader
```
Login (passkey/2FA) → Markets Overview → Select Pair (BTC/USDT) → Advanced Trading View →
Place Limit Order → View Open Orders → Check Trade History → Withdraw to External Wallet
```

### Journey C: API Integrator
```
Login → Settings → API Keys → Create Key (with permission scopes) → Read Docs →
Integrate REST/WebSocket → Monitor via Dashboard
```

### Journey D: Admin Operator
```
Admin Login (SSO + hardware key) → Dashboard → Review Pending KYC → Approve/Reject →
Monitor Suspicious Transactions → Generate Reports → Manage Trading Pairs
```

## 3. MVP vs Future Phases

### Phase 0 — Foundation (Months 1–3)
**Goal:** Core trading platform, internal testing

| Module           | Scope                                                    |
|------------------|----------------------------------------------------------|
| Auth             | Email/password, TOTP 2FA, passkey registration           |
| User Profile     | Basic profile, KYC status display                        |
| KYC              | Integration placeholder (Sumsub/Jumio interface)         |
| Wallets          | Crypto deposit addresses, balance tracking               |
| Spot Trading     | Market + limit orders, basic order book                  |
| Order Matching   | In-memory matching engine, persistent order book          |
| Market Data      | Real-time prices, OHLCV candles, WebSocket streaming     |
| Admin Panel      | User management, pair management, basic monitoring       |
| Audit Logs       | All state-changing operations logged                     |
| Infrastructure   | Docker Compose local, staging K8s, CI/CD pipeline        |

### Phase 1 — Beta (Months 4–5)
**Goal:** Invite-only beta, real deposits, real trades

| Module           | Scope                                                    |
|------------------|----------------------------------------------------------|
| KYC Integration  | Live vendor integration (Sumsub or equivalent)           |
| Fiat On-Ramp     | Integration placeholder (MoonPay/Transak interface)      |
| Deposits         | On-chain deposit detection (BTC, ETH, USDT)              |
| Withdrawals      | Manual approval queue, hot/cold wallet separation         |
| Notifications    | Email + in-app for trades, deposits, withdrawals         |
| Fee Engine       | Maker/taker fees, tiered by 30-day volume                |
| Security         | Rate limiting, IP allowlisting, withdrawal address book  |
| Monitoring       | Prometheus + Grafana dashboards, Sentry error tracking   |

### Phase 2 — Public Launch (Months 6–7)
**Goal:** Open registration, mobile apps, marketing push

| Module           | Scope                                                    |
|------------------|----------------------------------------------------------|
| Mobile Apps      | iOS + Android via React Native                           |
| Marketing Site   | Landing page, feature highlights, docs                   |
| Referral System  | Invite links, commission tracking, payout                |
| Price Alerts     | User-defined alerts via push + email                     |
| Support Center   | Help articles, ticket system integration placeholder     |
| Localization     | English + 3 additional languages                         |
| Public API       | REST + WebSocket, API key management, rate limits        |

### Phase 3 — Growth (Months 8–12)
**Goal:** Expand feature set, increase stickiness

| Module           | Scope                                                    |
|------------------|----------------------------------------------------------|
| Staking/Earn     | Fixed-term staking, flexible earn products               |
| Advanced Orders  | Stop-limit, OCO, trailing stop                           |
| Browser Extension| Portfolio view, quick trade, price ticker                |
| Sub-Accounts     | Institutional users, separate balances                   |
| OTC Desk         | Large trade negotiation interface                        |
| Analytics        | User behavior (PostHog), business metrics dashboards     |
| API Marketplace  | Public listing of third-party integrations               |

## 4. Full Feature Map

### 4.1 Authentication & Identity
- [x] Email + password registration
- [x] Passkey (WebAuthn) registration and login
- [x] TOTP-based 2FA (Google Authenticator compatible)
- [x] SMS 2FA (fallback, optional)
- [x] Device fingerprinting and trust scoring
- [x] Session management (multi-device, revocation)
- [x] Login history with IP/device/location
- [x] Anti-phishing code (user-set code shown in emails)
- [ ] SSO for admin panel (SAML/OIDC)
- [ ] Hardware security key support (FIDO2)

### 4.2 User Profile & KYC
- [x] Profile editing (display name, avatar, timezone)
- [x] KYC tier system (Tier 0: unverified, Tier 1: basic, Tier 2: enhanced)
- [x] Document upload interface
- [x] KYC vendor integration abstraction layer
- [x] KYC status tracking and notifications
- [ ] Corporate account KYC flow
- [ ] Address verification

### 4.3 Wallets & Balances
- [x] Per-asset balance tracking (available, locked, total)
- [x] Deposit address generation per user per asset
- [x] On-chain deposit detection (confirmation tracking)
- [x] Withdrawal request with 2FA confirmation
- [x] Hot wallet / cold wallet architecture
- [x] Withdrawal approval queue (admin)
- [x] Internal transfers between users
- [ ] Multi-sig cold wallet management
- [ ] Fiat balance and bank integration

### 4.4 Spot Trading
- [x] Market orders (buy/sell at best price)
- [x] Limit orders (buy/sell at specified price)
- [x] Order book display (bids/asks, depth chart)
- [x] Trade execution and settlement
- [x] Order cancellation
- [x] Trade history per user
- [x] Market history (recent trades ticker)
- [ ] Stop-limit orders
- [ ] OCO (one-cancels-other) orders
- [ ] Trailing stop orders
- [ ] Post-only / fill-or-kill order types

### 4.5 Matching Engine
- [x] Price-time priority matching
- [x] In-memory order book with persistent backup
- [x] Atomic balance updates on fill
- [x] Partial fill support
- [x] Trade event publishing (Kafka/RabbitMQ)
- [ ] Multi-asset matching engine scaling
- [ ] Cross-pair arbitrage detection

### 4.6 Market Data
- [x] Real-time price tickers (WebSocket)
- [x] OHLCV candlestick data (1m, 5m, 15m, 1h, 4h, 1d)
- [x] Order book depth snapshots
- [x] 24h volume, high, low, change %
- [x] Trading pair listings with metadata
- [ ] Historical data export (CSV)
- [ ] Market cap integration (CoinGecko/CMC placeholder)

### 4.7 Fee Engine
- [x] Maker/taker fee model
- [x] Volume-based tiered fee schedule
- [x] Fee calculation on order placement
- [x] Fee collection into platform revenue wallet
- [ ] Fee discounts for token holders
- [ ] Custom fee schedules for institutional users

### 4.8 Notifications & Alerts
- [x] Email notifications (transactional)
- [x] In-app notification center
- [x] Push notifications (mobile)
- [x] Price alert creation (above/below threshold)
- [x] Order fill notifications
- [x] Deposit/withdrawal status notifications
- [ ] Webhook notifications for API users
- [ ] Telegram/Discord bot integration

### 4.9 Referral & Rewards
- [x] Unique referral links per user
- [x] Referral tracking (sign-up, first trade)
- [x] Commission calculation and crediting
- [x] Referral dashboard (invites, earnings)
- [ ] Tiered referral rewards
- [ ] Campaign management (admin)

### 4.10 Staking / Earn
- [ ] Fixed-term staking products
- [ ] Flexible earn (daily yield)
- [ ] Staking position management
- [ ] Reward calculation and distribution
- [ ] Early unstaking penalties
- [ ] Product creation (admin)

### 4.11 Support
- [x] Help center (static articles)
- [x] Contact form / ticket submission
- [ ] Live chat integration placeholder
- [ ] Ticket management (admin)
- [ ] FAQ chatbot

### 4.12 Admin Panel
- [x] Dashboard (volume, users, revenue metrics)
- [x] User management (search, view, freeze, unfreeze)
- [x] KYC review queue
- [x] Trading pair management (add, enable, disable)
- [x] Withdrawal approval queue
- [x] Fee schedule configuration
- [x] Announcement management
- [x] Audit log viewer
- [ ] System health monitoring
- [ ] Role-based access control (RBAC)
- [ ] Report generation and export

### 4.13 Browser Extension
- [ ] Portfolio balance view
- [ ] Quick buy/sell widget
- [ ] Price ticker for watched assets
- [ ] Price alert management
- [ ] Session sharing with web app

### 4.14 Localization
- [x] i18n framework (ICU message format)
- [x] English (default)
- [ ] Spanish, Portuguese, Turkish, Vietnamese, Korean
- [ ] RTL support (Arabic)
- [ ] Currency display localization

### 4.15 Public API
- [x] REST API (market data, account, trading)
- [x] WebSocket API (real-time streams)
- [x] API key management (create, revoke, permissions)
- [x] Rate limiting per key
- [x] HMAC request signing
- [ ] FIX protocol gateway
- [ ] API usage analytics

Legend: [x] = MVP/Phase 0-1, [ ] = Phase 2-3+
