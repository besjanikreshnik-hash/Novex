# NovEx — E2E Testing with Playwright

## Overview

End-to-end tests verify the complete internal-alpha flow through the browser: login, trading, balance verification, order cancellation, and route protection. Tests use seeded accounts and produce screenshots for demo documentation.

## Prerequisites

1. **Backend running** at `http://localhost:3000` with seeded data
2. **Web app running** at `http://localhost:3001`
3. **Playwright installed** (`npm install` in packages/web)

## Quick Start

```bash
# Terminal 1: Infrastructure
cd infra/docker && docker compose up postgres redis kafka -d

# Terminal 2: Backend
cd packages/backend
npm run start:dev
# (wait for startup, then in same or another terminal):
npm run seed

# Terminal 3: Web
cd packages/web
npm run dev

# Terminal 4: Run E2E tests
cd packages/web
npx playwright install chromium   # first time only
npm run test:e2e
```

## Run Commands

```bash
npm run test:e2e          # Headless (CI mode)
npm run test:e2e:headed   # Watch in real browser
npm run test:e2e:ui       # Playwright UI mode (interactive)
```

## Test Scenarios

| # | Scenario | What It Verifies |
|---|----------|-----------------|
| 1 | Login as Alice | Seeded credentials work, redirect to /trade |
| 2 | Alice places buy limit | Order form submits, order appears in Open Orders |
| 3 | Login as Bob (separate session) | Second user session independent |
| 4 | Bob places matching sell | Order matches, trade executes |
| 5 | Verify fills for both users | Filled status in Fills tab for Alice and Bob |
| 6 | Verify balances update | Wallet page reflects trade (USDT debited/credited, BTC moved) |
| 7 | Place and cancel resting order | Cancel button works, order disappears from Open Orders |
| 8 | Verify locked funds released | Wallet locked column shows 0 after cancel |
| 9 | Protected route redirect | /trade and /wallet redirect to /login without auth |
| 10 | Capture demo screenshots | 7 screenshots saved to `e2e/screenshots/` |

## Screenshots

Tests save screenshots to `packages/web/e2e/screenshots/`:

```
01-alice-trade-page.png       — Alice's trade view after login
02-alice-buy-order-placed.png — Buy order in open orders
03-bob-trade-page.png         — Bob's trade view after login
04-bob-sell-order-matched.png — After Bob's sell matches Alice's buy
05a-alice-fills.png           — Alice's fills tab
05b-bob-fills.png             — Bob's fills tab
06a-alice-wallet-after-trade.png — Alice's wallet post-trade
06b-bob-wallet-after-trade.png   — Bob's wallet post-trade
07a-alice-resting-order.png   — Resting order in open orders
07b-alice-order-cancelled.png — After cancel
08-alice-funds-unlocked.png   — Wallet showing locked = 0
09-redirect-to-login.png      — Unauthenticated redirect
10a-final-alice-trade.png     — Final state captures
10b-final-alice-wallet.png
10c-final-bob-trade.png
10d-final-bob-wallet.png
10e-login-page.png
```

## Architecture

```
packages/web/
  playwright.config.ts     — Config (baseURL, single worker, sequential)
  e2e/
    helpers.ts             — Auth, trading, balance, screenshot utilities
    alpha-flow.spec.ts     — All 10 test scenarios
    screenshots/           — Output directory for demo screenshots
```

### Key Design Decisions

**Sequential execution**: Tests run in `serial` mode because they share seeded database state. Scenario 4 depends on scenario 2's resting order.

**Two browser contexts**: Alice and Bob use separate `BrowserContext` instances (like separate incognito windows) — independent cookies, storage, and auth state.

**Deterministic prices**: Orders use specific prices (48000, 30000) that don't conflict with other tests or pre-existing orders.

**HTTP + timeout waits**: After placing orders, tests wait 1.5-2s for WebSocket push + HTTP fallback to update the UI.

### Helper Functions

| Function | Purpose |
|----------|---------|
| `login(page, account)` | Fill credentials and submit login form |
| `logout(page)` | Click profile → Sign Out |
| `placeOrder(page, opts)` | Select side, fill price/amount, submit |
| `cancelFirstOrder(page)` | Click Cancel on first open order |
| `getBalance(page, asset)` | Navigate to wallet, read available balance |
| `getOpenOrderCount(page)` | Read badge count from Open Orders tab |
| `screenshot(page, name)` | Save to `e2e/screenshots/{name}.png` |
| `refreshAndWait(page)` | Reload + wait for settle |

## Resetting State

If tests leave stale orders that affect subsequent runs:

```bash
cd packages/backend
npm run db:reset    # Drop all → migrate → seed fresh
```

## CI Integration

Add to GitHub Actions workflow:

```yaml
e2e:
  needs: [build]
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:16-alpine
      env: { POSTGRES_USER: novex, POSTGRES_PASSWORD: novex_dev, POSTGRES_DB: novex }
      ports: ['5432:5432']
    redis:
      image: redis:7-alpine
      ports: ['6379:6379']
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: '20' }
    - run: cd packages/backend && npm ci && npm run start:dev &
    - run: sleep 5 && cd packages/backend && npm run seed
    - run: cd packages/web && npm ci && npx playwright install chromium
    - run: cd packages/web && npm run build && npm run start &
    - run: sleep 5 && cd packages/web && npm run test:e2e
    - uses: actions/upload-artifact@v4
      if: always()
      with:
        name: e2e-screenshots
        path: packages/web/e2e/screenshots/
```
