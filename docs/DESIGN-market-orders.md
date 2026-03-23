# NovEx — Market Order Execution Rules

## How Market Orders Work

A market order executes immediately against available book liquidity at the best available prices. Unlike limit orders, market orders:
- Never rest on the order book
- Sweep through price levels until filled or liquidity exhausted
- May partially fill if book depth is insufficient

## Execution Flow

```
placeOrder(type=market, side=buy, quantity=1 BTC)
  │
  ├── Validate pair is active
  ├── Check book has liquidity (asks exist for buy, bids for sell)
  ├── Estimate worst execution price from book depth
  ├── Check min notional (quantity × worstPrice ≥ minNotional)
  ├── Check max quantity
  ├── Lock funds with 1% buffer (market buy quote) or exact (market sell base)
  ├── Submit to matching engine with isMarket=true
  │   └── Engine skips price check → matches against all levels
  ├── Process matches (settlement, fees, fee_ledger — same as limit)
  ├── If partially filled: cancel remainder, unlock excess
  ├── If fully filled: unlock any buffer
  └── Return order with status and fill details
```

## Guardrails

| Guardrail | Behavior |
|-----------|----------|
| **Empty book** | Rejected before fund locking: "No liquidity available" |
| **Min notional** | `quantity × estimatedPrice ≥ pair.minNotional`. Default: 10 USDT |
| **Max quantity** | `quantity ≤ pair.maxQuantity`. 0 = unlimited |
| **Halted pair** | `pair.isActive = false` → rejected |
| **Partial fill** | Fills what's available, cancels remainder, unlocks excess funds |
| **Fund buffer** | Market buy locks worst-case price × qty × 1.01 (1% buffer), excess refunded after execution |
| **Slippage warning** | Client-side: UI estimates avg price from book and warns if >1% from last price |

## Matching Engine Behavior

Market orders set `isMarket: true` on the `BookOrder`. The engine:
1. **Skips price check**: No `if (taker.price < maker.price) break` — sweeps all levels
2. **Never rests**: After matching loop, remaining quantity is discarded (not inserted into book)
3. **STP still applies**: Self-trade prevention works the same as limit orders

## Fund Locking Strategy

| Side | What's Locked | Buffer | Excess Handling |
|------|--------------|--------|-----------------|
| Market buy | `worstPrice × quantity × 1.01` in quote currency | 1% | Unlocked after execution |
| Market sell | `quantity` in base currency | None | Unfilled portion unlocked |

The 1% buffer handles the race between price estimation and actual execution. Since the order book can change between estimation and matching, a small buffer prevents "insufficient balance" errors during execution.

## Partial Fill Behavior

When a market order can only partially fill:

```
Example: Market buy 2 BTC, but only 0.5 BTC on the ask book

Result:
  - Order status: CANCELLED (partial fill + cancel remainder)
  - filledQuantity: 0.5
  - filledQuote: 25000 (if filled at 50000)
  - User receives 0.5 BTC (minus taker fee)
  - Excess locked USDT unlocked
```

The order is marked CANCELLED (not PARTIALLY_FILLED) because market orders never rest. The filledQuantity tells the user how much was executed.

## Web UI

The OrderForm shows when market type is selected:
- **Estimated average price**: Calculated by walking the order book depth client-side
- **Estimated total**: Sum of `price × qty` across levels
- **Slippage indicator**: Percentage difference from last traded price
- **Partial fill warning**: If book depth < requested quantity
- **No liquidity warning**: If no levels exist on the opposite side
- **High slippage banner**: Yellow warning if estimated slippage > 1%

## Test Coverage

```bash
npm run test:market   # 9 integration tests
```

| Test | Scenario |
|------|----------|
| Market buy full fill | Sweeps best ask, correct settlement |
| Market sell full fill | Sweeps best bid, correct settlement |
| Partial fill | Fills 0.5 of 1, cancels remainder, unlocks excess |
| Empty book rejection | "No liquidity" error, no order persisted |
| Halted pair rejection | "not found or inactive" error |
| Min notional violation | Below threshold rejected |
| Min notional acceptance | At threshold accepted |
| Multi-level sweep | Fills across 3 price levels with correct prices |
| Zero-sum conservation | Total BTC and USDT unchanged after trade |
