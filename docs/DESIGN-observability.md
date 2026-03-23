# NovEx Observability Design

This document describes the metrics catalog, Grafana dashboards, alert rules,
and operator runbooks for the NovEx trading platform.

---

## 1. Architecture overview

```
NestJS app
  ├── MetricsService (in-memory counters / histograms)
  ├── MetricsInterceptor (auto HTTP latency + 5xx tracking)
  └── GET /admin/metrics  →  JSON snapshot
          │
          ▼
  Prometheus scraper (or adapter)
          │
          ▼
  Grafana dashboards  ←──  Alert rules (Alertmanager)
```

`MetricsService` is a lightweight, zero-dependency, `@Global()` injectable
that stores counters and histogram ring-buffers in process memory. It is
designed to have negligible overhead on the hot order-placement path.

A Prometheus scrape adapter can convert the JSON snapshot into standard
exposition format; alternatively the `/admin/metrics` endpoint can be
consumed directly by monitoring infrastructure.

---

## 2. Metrics catalog

| Metric name                        | Type      | Labels              | Description |
|------------------------------------|-----------|---------------------|-------------|
| `order_placement_count`            | counter   | -                   | Total orders placed |
| `order_placement_latency_ms`       | histogram | -                   | End-to-end latency for POST /orders |
| `order_cancel_count`               | counter   | -                   | Total order cancellations |
| `match_to_settlement_latency_ms`   | histogram | -                   | Time between match and wallet settlement |
| `market_order_rejection_count`     | counter   | `reason`            | Market orders rejected (slippage, no liquidity, etc.) |
| `slippage_bound_rejection_count`   | counter   | -                   | Orders rejected due to slippage bounds |
| `idempotency_replay_count`         | counter   | -                   | Responses served from idempotency cache |
| `ws_reconnect_count`               | counter   | -                   | Client WebSocket reconnections |
| `reconciliation_mismatch_count`    | counter   | -                   | Mismatches found during reconciliation runs |
| `treasury_fee_collected`           | counter   | `asset`             | Cumulative fees collected per asset |
| `cancel_failure_count`             | counter   | -                   | Failed order cancellation attempts |
| `http_5xx_count`                   | counter   | `endpoint`, `status`| HTTP 5xx responses by route |

### Histograms

Histogram metrics (`*_latency_ms`) maintain a capped ring-buffer of the last
100 observed values. `MetricsService.percentile(metric, p)` computes
point-in-time percentiles from this buffer.

---

## 3. Dashboard panels

Dashboard file: `infra/grafana/dashboards/novex-trading.json`

| # | Panel title                              | Metric(s) used                          | Visual type  |
|---|------------------------------------------|-----------------------------------------|--------------|
| 1 | Order Placement Rate                     | `order_placement_count`                 | Time series  |
| 2 | Order Placement Latency (p50/p95/p99)    | `order_placement_latency_ms`            | Time series  |
| 3 | Match-to-Settlement Latency              | `match_to_settlement_latency_ms`        | Time series  |
| 4 | Market Order Rejection Rate              | `market_order_rejection_count`, `slippage_bound_rejection_count` | Time series |
| 5 | Idempotency Replay Rate                  | `idempotency_replay_count`              | Time series  |
| 6 | WebSocket Reconnect Frequency            | `ws_reconnect_count`                    | Time series  |
| 7 | Reconciliation Mismatches                | `reconciliation_mismatch_count`         | Stat         |
| 8 | Cancel Failure Rate                      | `cancel_failure_count`                  | Stat         |
| 9 | Treasury Fee Accrual by Asset            | `treasury_fee_collected`                | Time series  |
| 10| HTTP 5xx Error Rate by Endpoint          | `http_5xx_count`                        | Time series  |

The dashboard auto-refreshes every 10 seconds and defaults to a 1-hour window.

---

## 4. Alert rules

Alert file: `infra/grafana/alerts/novex-alerts.yml`

### Critical severity

| Alert                    | Condition                                    | Action |
|--------------------------|----------------------------------------------|--------|
| ReconciliationMismatch   | `reconciliation_mismatch_count > 0`          | Fires immediately. Pages on-call. |
| DuplicateFeeLedger       | `duplicate_fee_ledger > 0`                   | Fires immediately. Pages on-call. |
| NegativeBalanceDetected  | `negative_balance_detected > 0`              | Fires immediately. Pages on-call. |

### High severity

| Alert                    | Condition                                    | Action |
|--------------------------|----------------------------------------------|--------|
| OrderEndpoint5xxRateHigh | 5xx rate on `/orders` > 1% for 5 min         | Notifies platform team Slack channel. |
| TreasuryFeeDrift         | Expected vs collected fee divergence for 5min | Notifies finance and platform teams.  |

### Warning severity

| Alert                    | Condition                                    | Action |
|--------------------------|----------------------------------------------|--------|
| WsDisconnectRateElevated | Reconnections > 50/min for 3 min             | Notifies platform team Slack channel. |

---

## 5. Operator runbooks

### 5.1 ReconciliationMismatch

**Severity:** Critical

1. Check the latest reconciliation run via `GET /admin/reconciliation/runs?limit=1`.
2. Inspect the mismatch details (asset, expected vs actual).
3. Determine whether the mismatch is from a pending settlement (transient)
   or a genuine ledger inconsistency.
4. If genuine: halt withdrawals for the affected asset, escalate to engineering.
5. Investigate recent trades and wallet mutations around the mismatch timestamp.
6. Once resolved, verify with a manual reconciliation run.

### 5.2 DuplicateFeeLedger

**Severity:** Critical

1. Query the `fee_ledger` table for entries sharing the same `trade_id`.
2. Identify the duplicate(s) and determine which is the original.
3. Create a corrective ledger entry or mark the duplicate as void.
4. Investigate the code path that allowed the duplicate (likely a retry
   without idempotency protection in the settlement flow).
5. Deploy a fix and verify with a reconciliation run.

### 5.3 NegativeBalanceDetected

**Severity:** Critical

1. Immediately halt withdrawals for the affected user and asset.
2. Query the wallet mutations log for the affected wallet.
3. Check for race conditions in concurrent order fills or withdrawals.
4. Correct the balance and investigate the root cause.
5. If exploitable, consider pausing trading for the affected pair.

### 5.4 OrderEndpoint5xxRateHigh

**Severity:** High

1. Check application logs: `kubectl logs -l app=novex-api --tail=200 | grep ERROR`.
2. Verify database connectivity and connection pool saturation.
3. Check for recent deployments that may have introduced the regression.
4. If database-related: check `pg_stat_activity` for long-running queries or locks.
5. Consider scaling up API pods if the issue is load-related.

### 5.5 TreasuryFeeDrift

**Severity:** High

1. Run a manual reconciliation: `POST /admin/reconciliation/trigger`.
2. Compare `fee_ledger` sum against the treasury wallet balance.
3. Check for trades that completed without fee entries.
4. Investigate rounding differences in fee calculations.
5. Correct any missing fee entries and verify with another reconciliation.

### 5.6 WsDisconnectRateElevated

**Severity:** Warning

1. Check if a deployment or restart just occurred (expected spike).
2. Verify WebSocket gateway health: `kubectl get pods -l component=ws-gateway`.
3. Check load balancer logs for connection timeout patterns.
4. Monitor client-side error reports for connection failure reasons.
5. If persistent: check for memory leaks or file-descriptor exhaustion on
   the WebSocket pods.

---

## 6. Integration points

### Instrumenting application code

```typescript
// In any service that injects MetricsService:

// Counter increment
this.metrics.increment('order_cancel_count');

// Counter with labels
this.metrics.increment('market_order_rejection_count', { reason: 'no_liquidity' });

// Histogram observation
this.metrics.observe('match_to_settlement_latency_ms', elapsedMs);

// Fee tracking with asset label
this.metrics.increment('treasury_fee_collected', { asset: 'BTC' }, feeAmount);
```

### HTTP layer (automatic)

`MetricsInterceptor` is registered as `APP_INTERCEPTOR` and automatically
tracks `order_placement_latency_ms`, `order_placement_count`, and
`http_5xx_count` for every request.

---

## 7. Future improvements

- Replace in-memory store with a Prometheus client library for native scraping.
- Add per-trading-pair labels to order and latency metrics.
- Instrument database query latency as a separate histogram.
- Add SLO-based burn-rate alerts for order placement latency.
- Integrate with PagerDuty or Opsgenie for critical alert routing.
