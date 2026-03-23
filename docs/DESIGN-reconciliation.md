# NovEx — Reconciliation & Accounting Invariants

## Overview

The reconciliation system is an internal audit tool that verifies the accounting integrity of the NovEx exchange. It checks that wallet balances, trade settlements, fee collections, and order states remain mathematically consistent.

Every reconciliation run produces an immutable record with a pass/fail status and detailed mismatch entries for any violations found.

## Invariant Model

The system checks six invariants on every run:

| ID    | Invariant                         | What It Catches                                          |
|-------|-----------------------------------|----------------------------------------------------------|
| INV-1 | No negative available balance     | Settlement bugs, double-spend, unlock overflows          |
| INV-2 | No negative locked balance        | Lock/unlock ordering bugs, cancel logic errors           |
| INV-3 | fee_ledger sum = treasury balance | Missing creditFee() calls, corrupted fee amounts         |
| INV-4 | Every trade has fee_ledger entries| Failed fee persistence, partial transaction commits      |
| INV-5 | No order overfills               | Matching engine bugs (filledQty > originalQty)           |
| INV-6 | Trade quote = price × base       | Decimal arithmetic errors, data corruption               |
| INV-7 | Trade-derived fees = treasury     | Cross-checks fee_ledger against trade records            |

### Check Execution

All checks run against the **current database state** in a single reconciliation run. Checks are read-only — they never modify any data.

```
executeRun()
  ├── discover distinct assets in wallets
  ├── INV-1: SELECT wallets WHERE available < 0
  ├── INV-2: SELECT wallets WHERE locked < 0
  ├── for each asset:
  │   ├── INV-3: SUM(fee_ledger.amount) WHERE asset = ? vs treasury wallet
  │   └── INV-7: SUM(trade buyer/seller fees) WHERE fee_asset = ? vs treasury
  ├── INV-4: for each trade with non-zero fees, check fee_ledger entry exists
  ├── INV-5: SELECT orders WHERE filledQuantity > quantity
  └── INV-6: for each trade, verify gross_quote ≈ price × gross_base
```

## Data Model

### `reconciliation_runs`

| Column          | Type         | Description                                  |
|-----------------|--------------|----------------------------------------------|
| id              | UUID PK      | Run identifier                               |
| status          | enum         | running, passed, failed, error               |
| finished_at     | timestamptz  | When the run completed                       |
| assets_checked  | varchar      | Comma-separated list of assets examined      |
| mismatch_count  | int          | Total mismatches found                       |
| checks_executed | int          | Total invariant checks run                   |
| trigger         | varchar      | Who triggered: api, admin, scheduler         |
| error_message   | text         | Error details if status = error              |

### `reconciliation_mismatches`

| Column          | Type         | Description                                  |
|-----------------|--------------|----------------------------------------------|
| id              | UUID PK      | Mismatch identifier                          |
| run_id          | UUID FK      | Parent run                                   |
| mismatch_type   | enum         | One of the MismatchType values               |
| asset           | varchar(10)  | Asset involved                               |
| description     | text         | Human-readable explanation                   |
| expected_value  | varchar      | What the value should be                     |
| actual_value    | varchar      | What the value actually is                   |
| difference      | varchar      | abs(expected − actual)                       |
| reference_id    | UUID         | ID of the offending entity (wallet/trade/order) |
| reference_type  | varchar      | Type of referenced entity                    |

## API Endpoints

All endpoints are under `/api/v1/admin/reconciliation/`. In production, protect with admin auth guard + IP allowlist.

### Trigger a Run

```
POST /api/v1/admin/reconciliation/run?trigger=admin

Response:
{
  "runId": "uuid",
  "status": "passed" | "failed",
  "checksExecuted": 12,
  "mismatchCount": 0,
  "assetsChecked": "BTC,ETH,SOL,USDT",
  "startedAt": "2026-03-22T...",
  "finishedAt": "2026-03-22T...",
  "mismatches": []
}
```

### List Past Runs

```
GET /api/v1/admin/reconciliation/runs?limit=20&offset=0
```

### Get Run Details

```
GET /api/v1/admin/reconciliation/runs/:id
```

### Query Mismatches

```
GET /api/v1/admin/reconciliation/mismatches?type=fee_ledger_treasury_mismatch&asset=BTC
```

## Operator Workflow

### Scheduled Runs

Configure a cron job or Kubernetes CronJob to hit the reconciliation endpoint:

```bash
# Every hour
0 * * * * curl -X POST https://admin.novex.io/api/v1/admin/reconciliation/run?trigger=scheduler
```

Or use NovEx's scheduled tasks system to create a recurring reconciliation task.

### When a Mismatch Is Found

1. **Alert fires** — The run returns `status: failed`. Wire this to PagerDuty/Slack.

2. **Investigate** — Query the mismatch details:
   ```
   GET /api/v1/admin/reconciliation/runs/{runId}
   ```
   Each mismatch includes:
   - `mismatch_type` — what invariant was violated
   - `description` — human-readable explanation
   - `expected_value` / `actual_value` / `difference` — the numbers
   - `reference_id` + `reference_type` — which entity to inspect

3. **Classify severity**:
   - **NEGATIVE_AVAILABLE / NEGATIVE_LOCKED** — Critical. User may have been double-credited. Freeze affected user, inspect audit logs.
   - **FEE_LEDGER_TREASURY_MISMATCH** — High. Revenue accounting is off. Check recent trade settlements.
   - **MISSING_FEE_LEDGER_ENTRY** — High. A trade settled but fee wasn't logged. Transaction may have partially committed.
   - **ORDER_OVERFILL** — Critical. Matching engine bug. Halt trading on affected pair, inspect order history.
   - **TRADE_QUOTE_MISMATCH** — Medium. Data integrity issue. Inspect the specific trade.
   - **SETTLEMENT_BALANCE_DRIFT** — High. Cross-check of fees reveals inconsistency.

4. **Remediate** — Based on root cause:
   - If a transaction partially committed: replay the missing operations manually
   - If a balance is wrong: create a manual adjustment entry (not yet implemented — future admin tool)
   - If matching engine bug: fix the bug, write a regression test, redeploy

5. **Verify** — Trigger another run to confirm the fix.

### Monitoring Dashboard

Add a Grafana panel that tracks:
- `reconciliation_runs` count by status (passed/failed/error) over time
- `reconciliation_mismatches` count by type
- Time since last successful run (alert if > 2 hours)

## Test Coverage

The test suite (`npm run test:recon`) covers:

| Scenario                          | What's tested                                    |
|-----------------------------------|--------------------------------------------------|
| Clean state, no trades            | PASSED with zero mismatches                      |
| Clean state after standard trade  | All invariants pass post-settlement              |
| Missing fee_ledger entry          | Detects deleted buyer_fee row                    |
| Treasury balance corruption       | Detects manually altered treasury wallet         |
| Negative locked balance           | Detects corrupted wallet.locked                  |
| Negative available balance        | Detects corrupted wallet.available               |
| Settlement balance drift          | Detects zeroed treasury vs trade-derived total   |
| Order overfill                    | Detects filledQuantity > quantity                |
| Trade quote inconsistency         | Detects modified gross_quote                     |
| Run listing and pagination        | Query interface works correctly                  |
| Mismatch filtering by type        | Type-based queries return correct results        |

## Future Enhancements

- **Deposit/withdrawal reconciliation** — Verify on-chain deposits match credited balances
- **Locked balance ↔ open orders cross-check** — Sum of all open order locks should equal wallet locked amounts
- **Historical reconciliation** — Run against a point-in-time snapshot
- **Auto-halt** — Automatically pause trading if critical mismatches exceed threshold
- **Admin UI panel** — Visual dashboard for run history and mismatch drill-down
