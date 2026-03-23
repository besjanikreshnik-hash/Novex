# NovEx — UX/UI Design System

## 1. Design Tokens

### Colors

```
Brand:
  --nvx-primary:       #6C5CE7    (Electric Violet)
  --nvx-primary-hover: #5A4BD1
  --nvx-primary-light: #A29BFE

Semantic:
  --nvx-success:       #00D68F    (Green — profits, deposits confirmed)
  --nvx-danger:        #FF3D71    (Red — losses, errors, sell)
  --nvx-warning:       #FFAA00    (Amber — pending, caution)
  --nvx-info:          #0095FF    (Blue — informational)

Dark Theme (Default):
  --nvx-bg-primary:    #0D0D1A    (Near-black deep blue)
  --nvx-bg-secondary:  #151528    (Card backgrounds)
  --nvx-bg-tertiary:   #1E1E3A    (Elevated surfaces)
  --nvx-text-primary:  #FFFFFF
  --nvx-text-secondary:#8F8FA3
  --nvx-text-muted:    #5C5C73
  --nvx-border:        #2A2A45
  --nvx-border-hover:  #3D3D5C

Light Theme:
  --nvx-bg-primary:    #FAFAFE
  --nvx-bg-secondary:  #FFFFFF
  --nvx-bg-tertiary:   #F0F0F8
  --nvx-text-primary:  #1A1A2E
  --nvx-text-secondary:#666680
  --nvx-border:        #E0E0EB

Trade Colors:
  --nvx-buy:           #00D68F    (Green for buy/long)
  --nvx-sell:          #FF3D71    (Red for sell/short)
```

### Typography

```
Font Family:
  --nvx-font-sans:     'Inter', -apple-system, sans-serif
  --nvx-font-mono:     'JetBrains Mono', 'Fira Code', monospace

Scale:
  --nvx-text-xs:       0.75rem / 1rem      (12px — captions)
  --nvx-text-sm:       0.875rem / 1.25rem   (14px — secondary text)
  --nvx-text-base:     1rem / 1.5rem        (16px — body text)
  --nvx-text-lg:       1.125rem / 1.75rem   (18px — subheadings)
  --nvx-text-xl:       1.25rem / 1.75rem    (20px — section titles)
  --nvx-text-2xl:      1.5rem / 2rem        (24px — page titles)
  --nvx-text-3xl:      1.875rem / 2.25rem   (30px — hero text)
  --nvx-text-price:    1.5rem / monospace   (Ticker prices)

Weight:
  Regular: 400  |  Medium: 500  |  Semibold: 600  |  Bold: 700
```

### Spacing

```
--nvx-space-1:  0.25rem   (4px)
--nvx-space-2:  0.5rem    (8px)
--nvx-space-3:  0.75rem   (12px)
--nvx-space-4:  1rem      (16px)
--nvx-space-5:  1.25rem   (20px)
--nvx-space-6:  1.5rem    (24px)
--nvx-space-8:  2rem      (32px)
--nvx-space-10: 2.5rem    (40px)
--nvx-space-12: 3rem      (48px)
```

### Border Radius

```
--nvx-radius-sm:   4px
--nvx-radius-md:   8px
--nvx-radius-lg:   12px
--nvx-radius-xl:   16px
--nvx-radius-full: 9999px  (pills, avatars)
```

## 2. Component Library

### Core Components

```
Layout:         Page, Container, Sidebar, Header, Footer, Grid, Stack
Navigation:     Navbar, TabBar, Breadcrumb, Drawer, BottomNav (mobile)
Data Display:   Table, Card, Stat, Badge, Avatar, Tooltip, Tag
Data Input:     Input, Select, Checkbox, Toggle, Slider, DatePicker
Financial:      PriceDisplay, PercentChange, OrderBookRow, CandleChart
Feedback:       Alert, Toast, Modal, ConfirmDialog, Skeleton, Spinner
Trading:        OrderForm, OrderBookWidget, TradeHistoryTicker, DepthChart
Wallet:         BalanceCard, AssetRow, AddressDisplay, QRCode
```

### Tailwind Configuration

```javascript
// tailwind.config.ts
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        nvx: {
          primary: '#6C5CE7',
          'primary-hover': '#5A4BD1',
          success: '#00D68F',
          danger: '#FF3D71',
          warning: '#FFAA00',
          buy: '#00D68F',
          sell: '#FF3D71',
          bg: { primary: '#0D0D1A', secondary: '#151528', tertiary: '#1E1E3A' },
          text: { primary: '#FFFFFF', secondary: '#8F8FA3', muted: '#5C5C73' },
          border: { DEFAULT: '#2A2A45', hover: '#3D3D5C' },
        },
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        mono: ['JetBrains Mono', ...defaultTheme.fontFamily.mono],
      },
    },
  },
};
```

## 3. Page Layouts

### Web — Trading View

```
┌─────────────────────────────────────────────────────────┐
│  [Logo]  Markets  Trade  Wallet  Earn    [Profile] [🔔] │  ← Top Nav (56px)
├───────────┬─────────────────────────────┬───────────────┤
│  Pair     │                             │  Order Book   │
│  Selector │      Chart Area             │  Bids / Asks  │
│  + Info   │      (TradingView)          │  Depth Chart  │
│           │                             │               │
│  24h Vol  │                             │               │
│  Change   │                             │               │
├───────────┼─────────────────────────────┼───────────────┤
│           │  Recent Trades Ticker       │  Order Form   │
│  Markets  │                             │  Buy | Sell   │
│  List     │                             │  [Market|Limit]│
│  (mini)   │                             │  Price, Qty   │
│           │                             │  [Place Order]│
├───────────┴─────────────────────────────┴───────────────┤
│  Open Orders  │  Order History  │  Trade History  │ Funds│  ← Bottom Tabs
│  [Table of active orders with cancel buttons]           │
└─────────────────────────────────────────────────────────┘
```

### Mobile — Trading View

```
┌──────────────────────┐
│ ← BTC/USDT   ☆  ⋮  │  ← Header
├──────────────────────┤
│ $64,230.50  +2.35%   │  ← Price bar
├──────────────────────┤
│                      │
│   Chart (compact)    │  ← Collapsible
│                      │
├──────────────────────┤
│ Order Book │ Trades  │  ← Tabs
│ ─────────  ─────     │
│ 64,250  0.523       │
│ 64,248  1.200       │
│ ═══════════════════ │  ← Spread
│ 64,230  0.890       │
│ 64,228  2.100       │
├──────────────────────┤
│  [Buy]      [Sell]   │  ← Sticky bottom
│  Price: [Market ▼]   │
│  Amount: [____]      │
│  Total:  0.00 USDT   │
│  [Place Buy Order]   │
├──────────────────────┤
│ 🏠  📊  💱  💼  👤 │  ← Bottom Tab Bar
└──────────────────────┘
```

### Responsive Breakpoints

```
Mobile:   < 768px   — Single column, bottom nav
Tablet:   768–1024  — Two column, collapsible sidebar
Desktop:  1024–1440 — Three column trading layout
Wide:     > 1440    — Full trading dashboard with expanded panels
```

## 4. Interaction Patterns

### Order Placement

```
1. User selects pair → pair info updates
2. User types price (limit) → total auto-calculates
3. User types quantity → total auto-calculates
4. Slider for percentage of available balance
5. Click "Place Order" →
   If no 2FA: prompt to enable
   If 2FA: confirm button (no separate modal for speed)
6. Order submitted → optimistic update in order table
7. WebSocket confirms → update status
```

### Deposit Flow

```
1. Wallet → Select asset → "Deposit"
2. Select network (dropdown with fee/speed info)
3. Display deposit address + QR code
4. Copy button with confirmation
5. Show minimum deposit amount
6. Show confirmation requirements
7. Real-time status tracking after deposit detected
```

### Withdrawal Flow

```
1. Wallet → Select asset → "Withdraw"
2. Enter/select destination address
3. Select network
4. Enter amount (with "Max" button)
5. Show fee breakdown
6. Enter 2FA code
7. Confirmation screen with all details
8. Submit → pending status
9. Email confirmation if new address
```

## 5. Animation & Micro-interactions

```
Price Changes:  Flash green/red on price update (200ms fade)
Order Book:     Smooth bar width transitions
Order Fill:     Brief glow effect on filled order row
Toast:          Slide in from top-right, auto-dismiss 5s
Tab Switch:     Animated underline slide
Loading:        Skeleton screens (not spinners) for data
Charts:         Smooth crossfade between timeframes
Modal:          Fade + scale-up (150ms ease-out)
```

## 6. Accessibility

```
- All interactive elements keyboard navigable
- ARIA labels on all icon-only buttons
- Minimum contrast ratio 4.5:1 (WCAG AA)
- Focus visible indicators (ring style)
- Screen reader announcements for price alerts, order fills
- Reduced motion preference respected
- Color not sole indicator (green/red supplemented with ↑↓ arrows)
```
