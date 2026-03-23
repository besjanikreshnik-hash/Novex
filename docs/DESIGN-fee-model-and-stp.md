# NovEx — Fee Model & Self-Trade Prevention Design Note

## Fee Accounting Model

### Problem

The original settlement charged fees as `quantity × feeRate`, producing a fee denominated in base asset units (e.g., BTC), then subtracted it from the **quote** asset credit (e.g., USDT). This is a cross-asset deduction — subtracting 0.001 BTC from 50,000 USDT is economically incoherent and makes auditing impossible.

### Solution: "Fee in Received Asset"

Each party is charged a fee **in the same asset they receive**:

| Party  | Sends       | Receives     | Fee Asset | Fee Calculation               |
|--------|-------------|-------------|-----------|-------------------------------|
| Buyer  | quote (USDT)| base (BTC)  | BTC       | `grossBase × buyerFeeRate`    |
| Seller | base (BTC)  | quote (USDT)| USDT      | `grossQuote × sellerFeeRate`  |

**Settlement per trade:**

```
grossBase  = matched quantity (e.g., 1 BTC)
grossQuote = price × grossBase (e.g., 50,000 USDT)

Buyer:
  debit  USDT locked:    grossQuote            (50,000 USDT)
  credit BTC  available: grossBase − buyerFee  (1 − 0.002 = 0.998 BTC)

Seller:
  debit  BTC  locked:    grossBase              (1 BTC)
  credit USDT available: grossQuote − sellerFee (50,000 − 50 = 49,950 USDT)

Platform treasury:
  credit BTC:  buyerFee   (0.002 BTC)
  credit USDT: sellerFee  (50 USDT)
```

### Why This Model

1. **Asset consistency** — No amount in one currency is ever subtracted from a balance in another currency. Every debit/credit operates on a single asset.

2. **Auditable** — The `fee_ledger` table records every fee with its exact asset and amount. Platform revenue is verifiable by summing `fee_ledger` grouped by asset.

3. **Industry standard** — This matches the model used by major exchanges (fee charged on the asset you receive).

4. **Maker/taker rates preserved** — The fee rate depends on whether the party was maker or taker, but the fee is always charged in the received asset. A buyer-maker pays `grossBase × makerRate` in BTC; a buyer-taker pays `grossBase × takerRate` in BTC.

### Trade Entity Changes

New explicit columns on `trades`:

| Column            | Type       | Description                              |
|-------------------|------------|------------------------------------------|
| `gross_base`      | decimal    | Base quantity before fees                |
| `gross_quote`     | decimal    | Quote quantity before fees               |
| `buyer_fee_amount`| decimal    | Fee charged to buyer                     |
| `buyer_fee_asset` | varchar(10)| Asset of buyer fee (always base)         |
| `seller_fee_amount`| decimal   | Fee charged to seller                    |
| `seller_fee_asset`| varchar(10)| Asset of seller fee (always quote)       |
| `maker_fee_rate`  | decimal    | Maker rate snapshot at execution time    |
| `taker_fee_rate`  | decimal    | Taker rate snapshot at execution time    |
| `buyer_user_id`   | uuid       | Who bought (may be maker or taker)       |
| `seller_user_id`  | uuid       | Who sold (may be maker or taker)         |

Removed: `quantity`, `quote_quantity`, `maker_fee`, `taker_fee` (ambiguous).

### Platform Fee Treasury

- Uses a well-known deterministic UUID: `00000000-0000-0000-0000-000000000001`
- Wallet rows are created automatically via `WalletsService.creditFee()`
- The `fee_ledger` table provides the complete audit trail (trade_id, asset, amount, source, user_id)

---

## Self-Trade Prevention (STP)

### Problem

Without STP, a user can place a buy and sell order at the same price, executing a trade against themselves. This can be used for wash trading, artificial volume inflation, or fee manipulation.

### Solution: Configurable STP per Market

Three modes, configured per `trading_pairs.stp_mode`:

| Mode           | Behavior                                                      |
|----------------|---------------------------------------------------------------|
| `cancel_taker` | Default. Incoming taker is cancelled if it would self-match.  |
| `cancel_maker` | Resting maker is removed; taker continues to next level.      |
| `none`         | Self-trades allowed (testing only).                           |

### How It Works

In the matching loop, before executing a fill:

```
if maker.userId === taker.userId AND stpMode !== 'none':
  if cancel_taker: set taker.remainingQty = 0, emit StpEvent, break
  if cancel_maker: splice maker from book, emit StpEvent, continue
```

### Event Flow

1. Engine emits `stp.triggered` event with details (symbol, userId, both order IDs, mode, which was cancelled)
2. `TradingService.handleStpEvents()`:
   - Unlocks the cancelled order's remaining funds
   - Sets the cancelled order's status to `CANCELLED`
3. Audit service can subscribe to `stp.triggered` for compliance logging

### Why cancel_taker as Default

- **Least disruptive**: The resting maker order (which was placed first) is preserved. Only the new incoming order is rejected.
- **Prevents wash trading**: The self-trade never executes, so no artificial volume is created.
- **User-friendly**: If a user accidentally submits a crossing order, they get immediate feedback (order cancelled) rather than silently losing their resting order.

### Future Considerations

- `cancel_both` mode (cancel both maker and taker portions)
- Per-user STP override for institutional sub-accounts
- STP event logging to audit_logs table for compliance reporting
