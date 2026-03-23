# NovEx — Local Alpha Demo

## Prerequisites

- Docker Desktop running
- Node.js 20+
- npm

## Setup (5 minutes)

### 1. Start infrastructure

```bash
cd infra/docker
docker compose up postgres redis kafka -d
```

Wait 10 seconds for services to be healthy.

### 2. Start the backend

```bash
cd packages/backend
cp .env.example .env
# Edit .env — set DATABASE_PASSWORD=novex_dev, DATABASE_NAME=novex
npm install
npm run start:dev
```

Backend starts at `http://localhost:3000`. Swagger docs at `http://localhost:3000/api/v1`.

On first start with `synchronize: true`, TypeORM creates all tables automatically.

### 3. Seed the database

In a new terminal:

```bash
cd packages/backend
npm run seed
```

This creates:
- **3 trading pairs**: BTC_USDT, ETH_USDT, SOL_USDT (0.1% maker / 0.2% taker fees)
- **3 test users** (password for all: `NovEx_Test_2024!`):
  - `admin@novex.io` — Admin user
  - `alice@test.novex.io` — 100,000 USDT + 2 BTC + 20 ETH + 500 SOL
  - `bob@test.novex.io` — 50,000 USDT + 1 BTC + 10 ETH + 200 SOL

### 4. Start the web app

```bash
cd packages/web
cp .env.example .env
# .env should contain: NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
npm install
npm run dev
```

Web app starts at `http://localhost:3001`.

## Demo Walkthrough

### Step 1: Login as Alice

1. Open `http://localhost:3001/login`
2. Click **"Alice (100K USDT)"** demo button — fills credentials
3. Click **Sign In**
4. You're redirected to the trade page

### Step 2: View balances

1. Click **Wallet** in the top nav
2. See Alice's balances: 100,000 USDT, 2 BTC, 20 ETH, 500 SOL
3. Toggle the eye icon to show/hide balances

### Step 3: Place a sell order (Alice sells BTC)

1. Click **Trade** in the top nav
2. Select **BTC/USDT** pair (default)
3. In the order form on the right:
   - Click **Sell** tab
   - Set price: `50000`
   - Set amount: `1`
   - Click **Sell BTC**
4. The order appears in **Open Orders** at the bottom
5. Check Wallet — 1 BTC is now locked

### Step 4: Login as Bob (second browser/incognito)

1. Open `http://localhost:3001/login` in incognito
2. Click **"Bob (1 BTC)"** — fills Bob's credentials
3. Click **Sign In**

### Step 5: Bob buys Alice's BTC

1. On Bob's trade page, ensure BTC/USDT is selected
2. Click **Buy** tab
3. Set price: `50000`
4. Set amount: `1`
5. Click **Buy BTC**

### Step 6: Verify the trade

**On Alice's browser (refresh or wait 5s):**
- Open Orders: Alice's sell order moved to **Fills** tab (status: filled)
- Wallet: Alice now has ~99,950 USDT (50000 received minus 0.1% maker fee) and 1 BTC (2 minus 1 sold)

**On Bob's browser:**
- Open Orders: Bob's buy order is in **Fills** tab (status: filled)
- Wallet: Bob has ~0.998 BTC (1 minus 0.2% taker fee) and ~0 USDT (50000 spent)

### Step 7: Place and cancel an order

1. On either account, place a limit order at a price that won't match (e.g., Buy 0.1 BTC @ 40000)
2. See it in Open Orders
3. Click **Cancel** on the order
4. Verify the locked funds are returned in Wallet

### Step 8: Cross-pair trading

1. Switch to ETH_USDT in the pair selector
2. Place orders to see the system works across multiple pairs

## API Endpoints (Quick Reference)

```
POST http://localhost:3000/api/v1/auth/login
  Body: { "email": "alice@test.novex.io", "password": "NovEx_Test_2024!" }

GET  http://localhost:3000/api/v1/market/pairs
GET  http://localhost:3000/api/v1/market/ticker/BTC_USDT
GET  http://localhost:3000/api/v1/market/orderbook/BTC_USDT

GET  http://localhost:3000/api/v1/wallets/balances
  Header: Authorization: Bearer <accessToken>

POST http://localhost:3000/api/v1/orders
  Header: Authorization: Bearer <accessToken>
  Body: { "symbol": "BTC_USDT", "side": "buy", "type": "limit", "price": "50000", "quantity": "1" }

GET  http://localhost:3000/api/v1/orders?symbol=BTC_USDT
  Header: Authorization: Bearer <accessToken>

DELETE http://localhost:3000/api/v1/orders/<orderId>
  Header: Authorization: Bearer <accessToken>
```

## Troubleshooting

**Backend won't start:** Check that PostgreSQL is running (`docker ps`) and `.env` values match docker compose (`novex` / `novex_dev` / `novex`).

**Login returns 401:** Seed hasn't run. Run `npm run seed` in the backend directory.

**No trading pairs shown:** Market data endpoint needs the seed to have created pairs. Verify with `curl http://localhost:3000/api/v1/market/pairs`.

**Order placement fails with "not found or inactive":** The pair symbol must exactly match (e.g., `BTC_USDT` not `BTC/USDT`).

**Balances don't update after trade:** The web app polls every 5 seconds. Refresh the page or wait.

## What's Wired End-to-End

| Flow | Status |
|------|--------|
| Register new account | Real backend auth |
| Login with email/password | Real JWT tokens |
| Auth token storage + auto-inject | localStorage + Bearer header |
| Protected routes (redirect to login) | AuthGuard on dashboard |
| Logout (revoke token) | Backend + clear local state |
| View trading pairs | Real backend query |
| View ticker (24h stats) | Real backend query |
| View order book | Real backend query |
| View wallet balances | Real backend query |
| Place limit order | Real backend with fund locking |
| View open orders | Real backend query with polling |
| Cancel open order | Real backend with fund unlock |
| View fills (trade history) | Real backend query |
| View cancelled orders | Real backend query |
| Demo account quick-fill | Pre-seeded test accounts |
