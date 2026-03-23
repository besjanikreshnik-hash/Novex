# NovEx -- Full Demo Walkthrough

This document provides a step-by-step script for demonstrating the NovEx crypto exchange platform. Each step includes what to show, what to say, and where to capture screenshots.

---

## Prerequisites

- Local environment running (see [LOCAL-SETUP.md](./LOCAL-SETUP.md))
- Database seeded with test data (`npm run seed` in backend)
- Two browser windows ready (one regular, one incognito)
- Admin panel accessible at `http://localhost:3002`

**Test accounts** (password for all: `NovEx_Test_2024!`):
- `admin@novex.io` -- Admin user
- `alice@test.novex.io` -- 100,000 USDT + 2 BTC + 20 ETH + 500 SOL
- `bob@test.novex.io` -- 50,000 USDT + 1 BTC + 10 ETH + 200 SOL

---

## Step 1: Landing Page Tour

1. Open `http://localhost:3001` in a browser
2. Walk through the landing page:
   - Hero section with exchange branding and call-to-action
   - Feature highlights (trading, security, low fees)
   - Market ticker showing live prices
   - Footer with links to about, API docs, support

[SCREENSHOT: Landing page hero section with market ticker]

[SCREENSHOT: Landing page feature highlights and footer]

---

## Step 2: Registration Flow

1. Click **Sign Up** / **Get Started** on the landing page
2. Navigate to `http://localhost:3001/register`
3. Fill in the registration form:
   - Full name
   - Email address
   - Password (show strength indicator)
   - Confirm password
   - Accept terms checkbox
4. Submit the form
5. Show the success confirmation / redirect to login

[SCREENSHOT: Registration form with fields filled in]

[SCREENSHOT: Registration success state]

---

## Step 3: Login

1. Navigate to `http://localhost:3001/login`
2. Click the **"Alice (100K USDT)"** demo quick-fill button
3. Credentials auto-populate
4. Click **Sign In**
5. Observe redirect to the trade page
6. Point out the JWT-based auth (token stored in localStorage, auto-injected via Bearer header)

> If 2FA is enabled on the account, show the TOTP prompt and enter the 6-digit code.

[SCREENSHOT: Login page with demo account buttons]

[SCREENSHOT: Post-login redirect to trade page]

---

## Step 4: Convert Page -- Quick Swap

1. Navigate to **Convert** in the sidebar/nav (`/convert`)
2. Select source asset: **USDT**
3. Select target asset: **BTC**
4. Enter amount: **1000 USDT**
5. Show the live conversion rate and estimated output
6. Click **Convert** to execute the swap
7. Show the confirmation with final amounts

[SCREENSHOT: Convert page with USDT to BTC conversion ready]

[SCREENSHOT: Conversion confirmation showing amounts]

---

## Step 5: Trade Page -- Charts and Orders

1. Navigate to **Trade** (`/trade`)
2. Ensure **BTC/USDT** pair is selected in the pair selector
3. Walk through the chart area:
   - Candlestick chart with time intervals (1m, 5m, 15m, 1H, 4H, 1D)
   - Volume bars below the chart
   - Technical indicators overlay (MA, EMA, RSI, MACD if available)
4. Show the order book:
   - Buy orders (bids) in green
   - Sell orders (asks) in red
   - Spread indicator
5. Place a **limit sell order** as Alice:
   - Click **Sell** tab
   - Price: `50000`
   - Amount: `1 BTC`
   - Click **Sell BTC**
6. Order appears in **Open Orders** panel at the bottom
7. Verify in Wallet that 1 BTC is now locked

[SCREENSHOT: Trade page with chart, order book, and order form visible]

[SCREENSHOT: Open Orders panel showing the new sell order]

---

## Step 6: Markets Page -- Browse All Pairs

1. Navigate to **Markets** (`/markets`)
2. Show the list of all available trading pairs
3. Demonstrate features:
   - Search/filter pairs by name
   - Sort by volume, price, 24h change
   - Favorite/star pairs
   - Click a pair row to jump to its trade page
4. Highlight the 24h change percentage colors (green/red)

[SCREENSHOT: Markets page showing full pair listing with 24h stats]

[SCREENSHOT: Markets page with search filter active]

---

## Step 7: Portfolio -- Allocation Overview

1. Navigate to **Portfolio** (`/portfolio`)
2. Show the portfolio summary:
   - Total portfolio value in USD
   - Donut/pie chart showing asset allocation percentages
   - Asset breakdown table (coin, amount, value, percentage)
3. Point out the visual balance of the portfolio
4. Show any profit/loss indicators if available

[SCREENSHOT: Portfolio page with donut chart and allocation table]

---

## Step 8: Wallet -- Balances, Deposit, Withdraw

1. Navigate to **Wallet** (`/wallet`)
2. Show Alice's balances:
   - 100,000 USDT, 2 BTC, 20 ETH, 500 SOL
   - Toggle the eye icon to hide/show balances
3. Click **Deposit** on any asset (`/wallet/deposit`):
   - Show the deposit address (or QR code)
   - Show the network selector (e.g., ERC-20, TRC-20)
4. Click **Withdraw** on any asset (`/wallet/withdraw`):
   - Show the withdrawal form (address, amount, network)
   - Show fee estimate and confirmation step

[SCREENSHOT: Wallet balances overview with all assets]

[SCREENSHOT: Deposit page showing address and QR code]

[SCREENSHOT: Withdraw page showing form and fee estimate]

---

## Step 9: Earn -- Staking Products

1. Navigate to **Earn** (`/earn`)
2. Show available staking products:
   - Asset name and APY rates
   - Lock period options (flexible, 30-day, 90-day)
   - Minimum stake amounts
3. Walk through a staking flow:
   - Select a product
   - Enter stake amount
   - Review terms and projected earnings
4. Show any active staking positions

[SCREENSHOT: Earn page showing staking products grid]

[SCREENSHOT: Staking detail view with APY and lock options]

---

## Step 10: P2P -- Peer-to-Peer Trading

1. Navigate to **P2P** (`/p2p`)
2. Show the P2P marketplace:
   - Active buy/sell listings from other users
   - Filters by asset, payment method, amount range
3. Demonstrate creating a new listing:
   - Click **Create Listing** / **Post Ad**
   - Select asset, price, amount, payment methods
   - Set terms and instructions
4. Show the listing preview

[SCREENSHOT: P2P marketplace with active listings]

[SCREENSHOT: Create new P2P listing form]

---

## Step 11: Alerts -- Price Notifications

1. Navigate to **Alerts** (`/alerts`)
2. Show any existing alerts
3. Create a new price alert:
   - Select pair: **BTC/USDT**
   - Condition: **Price drops below** `48000`
   - Notification method: email / in-app
   - Click **Create Alert**
4. Show the alert in the active alerts list

[SCREENSHOT: Alerts page with existing alerts]

[SCREENSHOT: New alert creation form]

---

## Step 12: History -- Orders and Export

1. Navigate to **History** (`/history`)
2. Show the tabbed views:
   - **Open Orders** -- currently active
   - **Filled Orders** -- completed trades
   - **Cancelled Orders** -- user-cancelled orders
3. Demonstrate the filters:
   - Date range picker
   - Pair filter
   - Side filter (buy/sell)
4. Click **Export CSV** to download the order history
5. Show the downloaded file structure

[SCREENSHOT: History page showing filled orders with filters]

[SCREENSHOT: Export CSV button and downloaded file]

---

## Step 13: Leaderboard -- Top Traders

1. Navigate to **Leaderboard** (`/leaderboard`)
2. Show the rankings:
   - Top traders by PnL (profit and loss)
   - Time period selector (daily, weekly, monthly, all-time)
   - Anonymized or display-name usernames
   - PnL amount and percentage
3. Point out the ranking badges or tiers

[SCREENSHOT: Leaderboard page showing top trader rankings]

---

## Step 14: Settings -- Account Configuration

1. Navigate to **Settings** (`/settings`)
2. Walk through each settings section:

**Security:**
- Show 2FA setup flow (TOTP with QR code scan)
- Show API key management (create, view, revoke)
- Show active sessions / activity log (`/settings/activity`)

**Preferences:**
- Language selector (switch between available languages)
- Theme toggle (light/dark mode) -- show the UI change
- Notification preferences

**Profile:**
- Display name, email (read-only)
- KYC verification status

[SCREENSHOT: Settings page -- security section with 2FA setup]

[SCREENSHOT: Settings page -- API key management]

[SCREENSHOT: Theme toggle showing dark mode vs light mode]

---

## Step 15: Admin Panel

1. Open `http://localhost:3002` in a new tab
2. Login with `admin@novex.io` / `NovEx_Test_2024!`
3. Walk through admin features:

**Dashboard:**
- Overview metrics (total users, trading volume, active pairs)

**Pairs Management** (`/pairs`):
- View all trading pairs
- Edit fees, enable/disable pairs
- Add new pairs

**User Management** (`/users`):
- Browse registered users
- View user details, balances, trade history

**KYC Review** (`/kyc`):
- Pending KYC submissions
- Approve/reject with notes

**Withdrawals** (`/withdrawals`):
- Pending withdrawal queue
- Approve/reject withdrawals

**Announcements** (`/announcements`):
- Create/edit platform announcements

**Audit Log** (`/audit`):
- System-wide activity log

[SCREENSHOT: Admin dashboard with overview metrics]

[SCREENSHOT: Admin pairs management page]

[SCREENSHOT: Admin user management with user detail view]

[SCREENSHOT: Admin KYC review queue]

---

## Step 16: API Documentation

1. Navigate to `http://localhost:3001/api-docs` (public docs page)
2. Show the API documentation:
   - Endpoint categories (Auth, Market, Orders, Wallet, etc.)
   - Request/response examples
   - Authentication requirements
3. Also show Swagger UI at `http://localhost:3000/api/v1`
4. Demonstrate a live API call:
   ```
   GET http://localhost:3000/api/v1/market/pairs
   GET http://localhost:3000/api/v1/market/ticker/BTC_USDT
   GET http://localhost:3000/api/v1/market/orderbook/BTC_USDT
   ```

[SCREENSHOT: API docs page showing endpoint categories]

[SCREENSHOT: Swagger UI with live endpoint testing]

---

## Step 17: Mobile App Demo

> Requires Expo Go installed on a physical device or emulator running.

1. Start the mobile app:
   ```bash
   cd packages/mobile
   npx expo start
   ```
2. Scan the QR code with Expo Go (iOS/Android)
3. Walk through the mobile experience:

**Login:**
- Same credentials as web (`alice@test.novex.io`)
- Biometric authentication prompt (if device supports)

**Home/Dashboard:**
- Portfolio summary card
- Quick actions (Buy, Sell, Convert, Deposit)
- Market movers (top gainers/losers)

**Trade:**
- Pair selector
- Simplified order form
- Swipe between chart and order book

**Wallet:**
- Asset list with balances
- Tap asset for deposit/withdraw
- QR scanner for addresses

**Settings:**
- Push notification preferences
- Biometric lock toggle
- Theme selection

[SCREENSHOT: Mobile login screen]

[SCREENSHOT: Mobile home/dashboard view]

[SCREENSHOT: Mobile trade screen with chart]

[SCREENSHOT: Mobile wallet and asset detail]

---

## End-to-End Trade Demo (Two Users)

This is the most impactful demo segment. Use two browser windows side by side.

### Setup
- **Window 1 (Alice):** Regular browser, logged in as Alice
- **Window 2 (Bob):** Incognito browser, logged in as Bob

### Flow

1. **Alice places a sell order:**
   - Trade page > BTC/USDT > Sell tab
   - Price: `50000`, Amount: `1 BTC`
   - Click Sell BTC
   - Order appears in Open Orders

2. **Bob places a matching buy order:**
   - Trade page > BTC/USDT > Buy tab
   - Price: `50000`, Amount: `1 BTC`
   - Click Buy BTC
   - Order matches immediately

3. **Verify on both sides:**
   - Alice: Open Orders clears, Fills shows the trade, Wallet shows ~99,950 USDT gained and 1 BTC deducted
   - Bob: Fills shows the trade, Wallet shows ~0.998 BTC gained (minus taker fee) and 50,000 USDT deducted

4. **Show the fee breakdown:**
   - Alice paid 0.1% maker fee
   - Bob paid 0.2% taker fee

[SCREENSHOT: Side-by-side browsers showing matched trade]

[SCREENSHOT: Alice's updated wallet after trade]

[SCREENSHOT: Bob's updated wallet after trade]

---

## Demo Tips

- **Keep it snappy:** The full walkthrough takes ~30 minutes. For a quick demo, focus on steps 3, 5, 7, 8, and the end-to-end trade.
- **Use demo buttons:** The login page has quick-fill buttons for test accounts -- use them instead of typing credentials.
- **Show real data flow:** Emphasize that all data is hitting real backend APIs, not mocked.
- **Dark mode:** Toggle to dark mode early in the demo for visual impact.
- **Error handling:** Optionally show what happens with invalid inputs (wrong password, insufficient balance, etc.).
