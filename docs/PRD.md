# NovEx — Product Requirements Document (PRD)

## Document Info
| Field      | Value                                    |
|------------|------------------------------------------|
| Product    | NovEx Centralized Crypto Exchange        |
| Version    | 1.0                                      |
| Status     | Draft                                    |
| Author     | Founding Team                            |

---

## 1. Problem Statement

Millions of people want to trade cryptocurrency but face platforms that are either:
- **Overly complex** for newcomers (intimidating UIs, jargon-heavy)
- **Insecure** (history of hacks, poor custody practices)
- **Opaque** about fees, compliance, and operational practices
- **Poorly integrated** across devices (web ≠ mobile experience)

NovEx solves this by delivering a premium exchange that progressively reveals complexity, prioritizes security by default, and provides a seamless multi-platform experience.

## 2. Target Audience

### Primary: Retail Crypto Traders
- Age: 22–45
- Tech comfort: Moderate to high
- Behavior: Buy/hold with occasional active trading
- Needs: Simple interface, mobile-first, trustworthy brand
- Pain: Overwhelmed by current exchange UIs, fear of losing funds

### Secondary: Active/Day Traders
- Age: 25–40
- Tech comfort: High
- Behavior: Multiple trades daily, use charts and indicators
- Needs: Fast execution, advanced order types, API access
- Pain: Latency, limited charting, poor API documentation

### Tertiary: API Integrators
- Profile: Bot developers, portfolio tracker builders, fintech companies
- Needs: Reliable API, good documentation, webhooks
- Pain: Rate limits, breaking API changes, poor error messages

## 3. User Stories

### 3.1 Authentication
```
US-AUTH-01: As a new user, I want to register with my email so I can create an account
US-AUTH-02: As a user, I want to log in with my email/password so I can access my account
US-AUTH-03: As a user, I want to enable 2FA so my account is more secure
US-AUTH-04: As a user, I want to use a passkey so I can log in without a password
US-AUTH-05: As a user, I want to see my active sessions so I can revoke unauthorized ones
US-AUTH-06: As a user, I want to be notified of new device logins for security
```

### 3.2 KYC & Profile
```
US-KYC-01: As a user, I want to submit my ID for verification so I can unlock higher limits
US-KYC-02: As a user, I want to see my KYC status and what limits apply to my tier
US-KYC-03: As a user, I want to edit my profile (display name, timezone)
US-KYC-04: As an admin, I want to review KYC submissions and approve/reject them
```

### 3.3 Wallets
```
US-WAL-01: As a user, I want to see all my asset balances in one place
US-WAL-02: As a user, I want to generate a deposit address for any supported asset
US-WAL-03: As a user, I want to track my deposit confirmations in real-time
US-WAL-04: As a user, I want to withdraw crypto to an external wallet
US-WAL-05: As a user, I want to manage a whitelist of withdrawal addresses
US-WAL-06: As a user, I want to see my deposit and withdrawal history
```

### 3.4 Trading
```
US-TRD-01: As a user, I want to place a market order to buy/sell at the current price
US-TRD-02: As a user, I want to place a limit order at my desired price
US-TRD-03: As a user, I want to see the live order book for any trading pair
US-TRD-04: As a user, I want to cancel my open orders
US-TRD-05: As a user, I want to see my trade history with fees paid
US-TRD-06: As a user, I want to see real-time price charts with candlesticks
US-TRD-07: As a user, I want to switch between simple and advanced trading views
```

### 3.5 Market Data
```
US-MKT-01: As a user, I want to see all available trading pairs with 24h stats
US-MKT-02: As a user, I want real-time price updates without refreshing
US-MKT-03: As a user, I want to search and filter trading pairs
US-MKT-04: As a user, I want to set price alerts for any asset
```

### 3.6 Notifications
```
US-NOT-01: As a user, I want email notifications for deposits, withdrawals, and trades
US-NOT-02: As a user, I want push notifications on my phone for alerts
US-NOT-03: As a user, I want to configure which notifications I receive
US-NOT-04: As a user, I want an in-app notification center
```

### 3.7 Referrals
```
US-REF-01: As a user, I want a unique referral link to share
US-REF-02: As a user, I want to earn commission when my referrals trade
US-REF-03: As a user, I want to see my referral stats and earnings
```

### 3.8 Admin
```
US-ADM-01: As an admin, I want a dashboard showing platform metrics
US-ADM-02: As an admin, I want to manage users (search, freeze, unfreeze)
US-ADM-03: As an admin, I want to manage trading pairs (add, configure, disable)
US-ADM-04: As an admin, I want to review and approve/reject withdrawals
US-ADM-05: As an admin, I want to view audit logs for all operations
US-ADM-06: As an admin, I want to create system announcements
```

## 4. Functional Requirements

### FR-01: Registration & Authentication
- System SHALL support email/password registration
- System SHALL enforce password strength (zxcvbn score ≥ 3)
- System SHALL send email verification on registration
- System SHALL support TOTP-based 2FA
- System SHALL support WebAuthn/passkey authentication
- System SHALL enforce 2FA for all withdrawal operations
- System SHALL support concurrent sessions with revocation
- System SHALL rate-limit login attempts (5/min per email)

### FR-02: Order Matching
- System SHALL implement price-time priority matching
- System SHALL support market and limit orders
- System SHALL process orders within 10ms (p95)
- System SHALL support partial fills
- System SHALL atomically update balances on trade execution
- System SHALL use decimal arithmetic for all financial calculations

### FR-03: Wallet Operations
- System SHALL generate unique deposit addresses per user per asset
- System SHALL detect on-chain deposits and credit after N confirmations
- System SHALL enforce withdrawal limits based on KYC tier
- System SHALL apply 24-hour hold on withdrawals to new addresses
- System SHALL require 2FA for all withdrawals
- System SHALL maintain hot/cold wallet separation

### FR-04: Market Data
- System SHALL provide real-time price updates via WebSocket
- System SHALL generate OHLCV candles (1m, 5m, 15m, 1h, 4h, 1d)
- System SHALL provide order book depth data
- System SHALL calculate 24h volume, high, low, change statistics

## 5. Non-Functional Requirements

### NFR-01: Performance
- API response time: p95 < 200ms, p99 < 500ms
- Matching engine: p99 < 10ms
- WebSocket broadcast: < 50ms latency
- Page load time: < 2s (web), < 1.5s (mobile)

### NFR-02: Availability
- Uptime target: 99.95% (approximately 4.38 hours downtime/year)
- Zero-downtime deployments
- Automated failover for databases

### NFR-03: Scalability
- Support 100,000 concurrent WebSocket connections
- Support 10,000 orders/second throughput
- Horizontal scaling for all API services

### NFR-04: Security
- All data encrypted at rest and in transit
- SOC 2 Type II readiness
- Annual penetration testing
- Bug bounty program (post-launch)

### NFR-05: Compliance
- KYC/AML integration ready
- Audit trail for all operations (7-year retention)
- GDPR-compliant data handling
- Geo-restriction enforcement

## 6. Out of Scope (v1)

- Margin/futures trading
- P2P trading
- Fiat bank integration (use third-party on-ramp)
- NFT marketplace
- Social/copy trading
- Lending/borrowing
- Launchpad/IEO platform
- Native desktop application

## 7. Success Metrics

| Metric                         | Target (6mo post-launch) |
|--------------------------------|--------------------------|
| Registered users               | 50,000                   |
| Monthly active traders         | 10,000                   |
| Daily trading volume           | $10M+                    |
| Deposit-to-first-trade time    | < 30 minutes (median)    |
| Customer support response time | < 4 hours                |
| Security incidents             | 0                        |
| API uptime                     | 99.95%+                  |

## 8. Dependencies & Risks

| Risk                              | Mitigation                                      |
|-----------------------------------|------------------------------------------------|
| Regulatory rejection              | Legal counsel early; modular compliance engine  |
| Security breach                   | Defense-in-depth; third-party audit; bug bounty |
| Matching engine performance       | Load testing; path to Rust/Go rewrite           |
| Third-party provider downtime     | Abstraction layer; fallback providers            |
| Market downturn reducing volume   | Lean operations; diversified revenue streams     |
| Key person risk (small team)      | Documentation; shared knowledge; IaC            |
