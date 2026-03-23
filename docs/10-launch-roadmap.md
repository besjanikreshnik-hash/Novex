# NovEx — Launch Roadmap & Checklists

## 1. Phased Launch Roadmap

### Phase 0: Foundation (Weeks 1–12)

```
Week 1-2: Project Setup
  ✓ Monorepo setup (packages/backend, web, mobile, admin, shared)
  ✓ Docker Compose local development environment
  ✓ CI/CD pipeline (lint, test, build)
  ✓ Database schema v1 + migrations
  ✓ Design system tokens + component scaffolding

Week 3-4: Auth & Users
  - Email/password registration + verification
  - Login with JWT sessions
  - TOTP 2FA setup and verification
  - Passkey registration/login
  - Device trust scoring
  - User profile CRUD
  - KYC integration interface (mock provider)

Week 5-6: Wallets
  - Asset management (admin: add/configure assets)
  - Per-user wallet creation
  - Deposit address generation
  - Balance tracking (available/locked)
  - Internal balance operations (lock/unlock/credit/debit)
  - Withdrawal request flow (no on-chain yet)

Week 7-9: Trading Engine
  - In-memory matching engine (price-time priority)
  - Order placement (market + limit)
  - Order cancellation
  - Trade execution and settlement
  - Balance updates on fill
  - Order book API + WebSocket
  - Fee calculation engine

Week 10-11: Market Data
  - Price ticker aggregation
  - OHLCV candle generation
  - WebSocket streaming (ticker, orderbook, trades)
  - Trading pair management

Week 12: Admin Panel v1
  - User management (list, view, freeze)
  - Trading pair management
  - Basic dashboard metrics
  - Audit log viewer

Milestone: Internal demo — team can register, deposit (mock), and trade
```

### Phase 1: Beta (Weeks 13–20)

```
Week 13-14: On-Chain Integration
  - Blockchain node connections (or provider integration)
  - Deposit detection (BTC, ETH, USDT)
  - Confirmation tracking
  - Hot wallet withdrawal processing
  - Deposit sweep jobs

Week 15-16: KYC + Compliance
  - KYC vendor integration (Sumsub/equivalent)
  - Tier enforcement (limits per tier)
  - Withdrawal address book
  - 24h hold on new withdrawal addresses
  - Basic transaction monitoring rules

Week 17-18: Notifications + Security
  - Email notifications (transactional: Deposit, Withdrawal, Trade, Login)
  - In-app notification center
  - Rate limiting (all sensitive endpoints)
  - IP-based security (new login alerts)
  - Anti-phishing code

Week 19-20: Beta Polish
  - Error handling and edge cases
  - Performance optimization
  - Staging environment deployment
  - Security audit (internal)
  - Invite system for beta testers

Milestone: Invite-only beta with real deposits, 3-5 trading pairs
```

### Phase 2: Public Launch (Weeks 21–28)

```
Week 21-23: Mobile Apps
  - iOS app feature parity with web (core flows)
  - Android app feature parity
  - Biometric authentication
  - Push notifications
  - App Store / Play Store submission prep

Week 24-25: Marketing Site + Referrals
  - Landing page (novex.io)
  - Feature pages, security page, API docs
  - Referral system (invite links, commission tracking)
  - Price alert system (push + email)

Week 26-27: Public API
  - REST API documentation (OpenAPI)
  - WebSocket API documentation
  - API key management UI
  - HMAC signing guide
  - Rate limiting per API key
  - Developer portal

Week 28: Launch
  - Production deployment
  - Monitoring and alerting active
  - Support system ready
  - Marketing campaign launch
  - 24/7 on-call rotation

Milestone: Public launch — open registration, 10+ trading pairs
```

### Phase 3: Growth (Weeks 29–52)

```
Months 8-9: Advanced Trading
  - Stop-limit orders
  - OCO orders
  - Trailing stops
  - Advanced charting (more indicators)
  - Trade history export (CSV)

Month 10: Staking & Earn
  - Fixed-term staking products
  - Flexible earn
  - Reward calculation engine
  - Staking dashboard

Month 11: Browser Extension
  - Portfolio view
  - Quick trade widget
  - Price alerts
  - Session sync with web app

Month 12: Optimization
  - Matching engine optimization (evaluate Rust/Go rewrite)
  - Database partitioning review
  - Read replica optimization
  - CDN optimization
  - Bug bounty program launch
```

## 2. App Store Readiness Checklist

### iOS (App Store)

```
Required:
  [ ] Apple Developer Program membership ($99/year)
  [ ] App Store Connect account setup
  [ ] Bundle ID registered (com.novex.app)
  [ ] App icons: 1024x1024 (App Store), all device sizes
  [ ] Screenshots: iPhone 6.7", 6.5", 5.5"; iPad 12.9", 11"
  [ ] App Preview videos (optional but recommended)
  [ ] Privacy Policy URL (required)
  [ ] Terms of Service URL
  [ ] App description (up to 4000 chars)
  [ ] Keywords (100 chars max)
  [ ] Category: Finance
  [ ] Age rating questionnaire completed
  [ ] Export compliance (encryption declaration)

Technical:
  [ ] App signed with distribution certificate
  [ ] Push notification entitlement
  [ ] Face ID / Touch ID usage description
  [ ] Camera usage description (if KYC selfie)
  [ ] Photo library usage description (if KYC doc upload)
  [ ] Network security: ATS compliant (HTTPS only)
  [ ] No private API usage
  [ ] Minimum iOS version: 16.0

Review Considerations:
  [ ] Cryptocurrency apps require additional review
  [ ] Must clearly state this is not a wallet but an exchange
  [ ] Guideline 3.1.1: In-App Purchase not required for crypto trading
  [ ] Must have functional demo/test mode for reviewers
  [ ] Include test account credentials in review notes
```

### Android (Google Play)

```
Required:
  [ ] Google Play Console account ($25 one-time)
  [ ] Package name registered (io.novex.app)
  [ ] App icons: 512x512 (high-res), 192x192 (launcher)
  [ ] Feature graphic: 1024x500
  [ ] Screenshots: Phone, Tablet (7" and 10")
  [ ] Privacy Policy URL
  [ ] App description (up to 4000 chars)
  [ ] Short description (up to 80 chars)
  [ ] Category: Finance
  [ ] Content rating questionnaire
  [ ] Target audience declaration (not for children)

Technical:
  [ ] App bundle (.aab) signed with upload key
  [ ] Play App Signing enrolled
  [ ] Minimum SDK: API 26 (Android 8.0)
  [ ] Target SDK: Latest stable (API 34+)
  [ ] 64-bit support
  [ ] Permissions declared and justified
  [ ] ProGuard/R8 enabled for release builds

Financial App Requirements:
  [ ] Cryptocurrency disclaimer in description
  [ ] Risk warnings clearly visible in app
  [ ] Compliant with Google's Financial Services policy
  [ ] No misleading claims about earnings/returns
```

## 3. Pre-Launch Security Checklist

```
Infrastructure:
  [ ] WAF rules active and tested
  [ ] DDoS protection enabled (AWS Shield)
  [ ] All services behind private subnets
  [ ] Admin panel IP-restricted
  [ ] SSL/TLS certificates valid and auto-renewing
  [ ] Secret rotation verified
  [ ] Backup/restore tested (full DR drill)

Application:
  [ ] All inputs validated server-side
  [ ] SQL injection testing passed
  [ ] XSS testing passed
  [ ] CSRF protection verified
  [ ] Rate limiting active on all endpoints
  [ ] JWT validation strict (algorithm, expiry, issuer)
  [ ] 2FA enforced for all withdrawals
  [ ] Password policy enforced (zxcvbn ≥ 3)

Wallet Security:
  [ ] Hot wallet private keys in HSM
  [ ] Hot wallet balance limits configured
  [ ] Cold wallet multi-sig tested
  [ ] Withdrawal approval queue functional
  [ ] Address validation for all supported chains
  [ ] Deposit confirmation thresholds set

Monitoring:
  [ ] All critical alerts configured and tested
  [ ] On-call rotation established
  [ ] Incident response runbook documented
  [ ] Escalation paths defined
  [ ] External uptime monitoring active
```

## 4. Founder Next Steps (Immediate Actions)

```
Week 0 (Before Coding):

  Legal:
  1. Consult a crypto/fintech attorney in your target jurisdiction
  2. Determine regulatory requirements (MSB, VASP, CASP, etc.)
  3. Establish a legal entity (company incorporation)
  4. Draft Terms of Service and Privacy Policy
  5. Understand tax obligations for the platform

  Business:
  6. Secure initial funding ($1M+ recommended for 12-month runway)
  7. Open a business bank account
  8. Set up accounting (crypto-aware accountant)
  9. Register domain (novex.io or chosen domain)
  10. Set up business email and communication tools

  Team:
  11. Hire/contract first backend engineer (matching engine focus)
  12. Hire/contract first frontend engineer (web + admin)
  13. Set up GitHub organization with branch protection
  14. Set up project management tool (Linear recommended)
  15. Establish coding standards and review process

  Infrastructure:
  16. Create AWS account with Organizations (multi-account strategy)
  17. Set up AWS SSO for team access
  18. Register for KYC provider sandbox (Sumsub recommended)
  19. Set up monitoring accounts (Sentry, PostHog)
  20. Configure development environments

  Security:
  21. Enable MFA on all business accounts (GitHub, AWS, email)
  22. Set up 1Password/Bitwarden for team secret sharing
  23. Plan for first security audit (schedule for end of Phase 1)
  24. Research and select penetration testing firm
  25. Draft incident response plan

  Product:
  26. Validate initial trading pair list (start with BTC, ETH, USDT pairs)
  27. Research fee structures of competitors
  28. Define initial KYC tiers and limits
  29. Design onboarding flow (wireframes)
  30. Identify beta tester community (crypto Discord/Telegram groups)
```
