# NovEx — Testing Strategy

## 1. Testing Pyramid

```
              ┌─────────┐
              │   E2E   │    5% — Critical user journeys
              ├─────────┤
            ┌─┤ Integr. ├─┐  20% — API + service integration
            ├─┴─────────┴─┤
          ┌─┤    Unit     ├─┐  75% — Business logic, utilities
          └───────────────┘
```

## 2. Unit Tests

### Backend (Jest)

```
Target: 80%+ coverage on business logic

Priority Modules:
  1. Matching Engine (100% coverage target)
     - Price-time priority ordering
     - Partial fills
     - Market order execution
     - Order cancellation
     - Edge cases: empty book, self-trade prevention

  2. Fee Calculation
     - Maker/taker fee application
     - Tiered fee lookup
     - Fee rounding (always round up for platform)

  3. Wallet Operations
     - Balance lock/unlock
     - Optimistic locking conflicts
     - Insufficient balance handling
     - Decimal precision

  4. Auth
     - Password hashing/verification
     - JWT generation/validation
     - 2FA code verification
     - Rate limit logic

Convention:
  - Co-located: auth.service.spec.ts next to auth.service.ts
  - Describe blocks mirror class methods
  - Factory functions for test data
  - No database in unit tests (mock repositories)
```

### Frontend (Jest + React Testing Library)

```
Target: 70%+ coverage on components

Priority:
  1. Order Form — validation, calculation, submission
  2. Order Book — rendering, price formatting, update handling
  3. Wallet — balance display, withdrawal form validation
  4. Auth forms — validation, error states

Convention:
  - Test user behavior, not implementation
  - Mock API calls with MSW (Mock Service Worker)
  - Test accessibility (aria roles, keyboard nav)
```

## 3. Integration Tests

### API Integration (Supertest + Test Database)

```
Setup:
  - Dedicated test PostgreSQL (Docker in CI)
  - Migrations run before test suite
  - Transactions rolled back between tests

Test Suites:
  1. Auth Flow
     - Register → verify email → login → get profile
     - Login with wrong password → 401
     - Login → enable 2FA → login with 2FA → success
     - Token refresh → new access token
     - Revoke session → old token rejected

  2. Trading Flow
     - Deposit funds → place limit order → verify order in book
     - Place matching orders → trade executed → balances updated
     - Place order → cancel → funds unlocked
     - Insufficient balance → order rejected

  3. Wallet Flow
     - Generate deposit address → unique per user
     - Request withdrawal → pending → approve → processed
     - Withdrawal with insufficient balance → rejected
     - Withdrawal to new address → 24h hold

  4. Admin Flow
     - List users → filter by KYC tier
     - Approve KYC → user tier updated
     - Freeze user → user cannot trade
     - Approve withdrawal → status updated
```

### WebSocket Integration

```
  - Connect → subscribe to ticker → receive updates
  - Subscribe to order book → receive snapshots + deltas
  - Authenticated: subscribe to orders → receive fill notifications
  - Connection drop → reconnect → resubscribe
```

## 4. End-to-End Tests (Playwright)

```
Critical Journeys:

  1. New User Onboarding
     Navigate to /register → fill form → submit →
     verify email (mock) → login → see dashboard

  2. Complete Trade
     Login → navigate to /trade → select pair →
     place buy order → verify in open orders →
     (simulate matching) → verify in trade history

  3. Deposit & Withdraw
     Login → wallet → generate deposit address →
     (simulate deposit) → verify balance →
     withdraw → enter 2FA → verify pending

  4. Account Security
     Login → settings → enable 2FA → logout →
     login → enter 2FA code → success

Browser Matrix:
  - Chrome (latest)
  - Firefox (latest)
  - Safari (latest, if available in CI)
  - Mobile Chrome (viewport emulation)
```

## 5. Performance Testing

```
Tool: k6

Scenarios:
  1. Baseline Load
     - 100 concurrent users
     - Mixed workload: 60% reads, 30% order placement, 10% other
     - Duration: 10 minutes
     - Target: p95 < 200ms, 0% errors

  2. Peak Load
     - 1000 concurrent users
     - Heavy trading simulation
     - Duration: 5 minutes
     - Target: p95 < 500ms, < 0.1% errors

  3. Matching Engine Stress
     - 10,000 orders/second
     - Monitor matching latency
     - Target: p99 < 10ms

  4. WebSocket Stress
     - 10,000 concurrent connections
     - 100 messages/second broadcast
     - Monitor memory and CPU

  5. Soak Test
     - 200 concurrent users
     - Duration: 4 hours
     - Monitor memory leaks, connection pool exhaustion
```

## 6. Security Testing

```
Automated (CI):
  - SAST: CodeQL for JavaScript/TypeScript
  - Dependency scanning: npm audit + Snyk
  - Container scanning: Trivy
  - Secret scanning: Gitleaks
  - OWASP ZAP baseline scan (staging)

Manual (Quarterly):
  - Penetration testing by third party
  - Focus areas: auth bypass, privilege escalation,
    trading logic manipulation, withdrawal bypass
  - Smart contract audit (when applicable)

Specific Tests:
  - SQL injection on all endpoints
  - XSS in user-controlled fields
  - CSRF protection verification
  - Rate limiting effectiveness
  - JWT manipulation attempts
  - API key permission boundary testing
  - Withdrawal address validation bypass attempts
```

## 7. Test Infrastructure

```
Local:
  - Jest watch mode for unit/integration
  - Docker Compose for dependencies
  - Playwright UI mode for E2E debugging

CI (GitHub Actions):
  - Parallel test execution across packages
  - PostgreSQL service container
  - Redis service container
  - Test results + coverage uploaded as artifacts
  - Coverage gates: fail if coverage drops below threshold
  - Flaky test detection: retry once, flag if inconsistent

Environments:
  - Test: Ephemeral, created per CI run
  - Staging: Persistent, mirrors production
  - Production: Smoke tests only (read-only endpoints)
```

## 8. QA Checklist (Pre-Release)

```
Functionality:
  [ ] All critical user journeys pass E2E
  [ ] API integration tests pass
  [ ] WebSocket connections stable under load
  [ ] Mobile app tested on iOS 16+ and Android 12+
  [ ] Browser extension tested on Chrome, Brave, Edge

Security:
  [ ] No critical/high vulnerabilities in dependency scan
  [ ] Container images pass Trivy scan
  [ ] No secrets in codebase (Gitleaks clean)
  [ ] Rate limiting verified on all sensitive endpoints
  [ ] 2FA enforcement verified for withdrawals
  [ ] CORS configuration verified

Performance:
  [ ] API p95 latency < 200ms under baseline load
  [ ] Matching engine p99 < 10ms
  [ ] WebSocket broadcast latency < 50ms
  [ ] No memory leaks in 4-hour soak test
  [ ] Database query performance reviewed (no N+1)

Data:
  [ ] All financial calculations use decimal arithmetic
  [ ] Balance changes are atomic (no race conditions)
  [ ] Audit logs capture all state changes
  [ ] Backup/restore tested

Compliance:
  [ ] KYC flow functional end-to-end
  [ ] Withdrawal holds enforced for new addresses
  [ ] Geo-blocking active for restricted jurisdictions
  [ ] Data retention policies implemented
```
