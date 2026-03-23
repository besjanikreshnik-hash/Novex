# NovEx — Prometheus/OpenTelemetry Observability

## Migration from In-Memory to Prometheus

### What Changed

The in-memory `MetricsService` with ring-buffer histograms has been replaced with `prom-client` — the standard Prometheus instrumentation library for Node.js. This is process-safe and compatible with multi-instance deployments.

### Old → New Metric Mapping

| Old In-Memory Metric | New Prometheus Metric | Type |
|---|---|---|
| `order_placement_count` | `novex_order_placement_total{symbol,side,type}` | Counter |
| `order_placement_latency_ms` | `novex_order_placement_duration_ms_bucket` | Histogram |
| `order_cancel_count` | `novex_order_cancel_total{symbol}` | Counter |
| `match_to_settlement_latency_ms` | `novex_match_to_settlement_duration_ms_bucket` | Histogram |
| `market_order_rejection_count` | `novex_market_order_rejection_total{reason}` | Counter |
| `slippage_bound_rejection_count` | `novex_slippage_rejection_total` | Counter |
| `idempotency_replay_count` | `novex_idempotency_replay_total` | Counter |
| `ws_reconnect_count` | `novex_ws_reconnect_total` | Counter |
| `reconciliation_mismatch_count` | `novex_reconciliation_mismatch_total{mismatch_type}` | Counter |
| `treasury_fee_collected` | `novex_treasury_fee_collected_total{asset,source}` | Counter |
| `cancel_failure_count` | `novex_cancel_failure_total{reason}` | Counter |
| `http_5xx_count` | `novex_http_5xx_total{method,route}` | Counter |

### New Metrics (not in old system)

| Metric | Type | Labels | Purpose |
|---|---|---|---|
| `novex_http_requests_total` | Counter | method, route, status_bucket | All HTTP traffic |
| `novex_http_request_duration_ms` | Histogram | method, route, status_bucket | Full request latency |
| `novex_http_429_total` | Counter | method, route | Rate limit events |
| `novex_trade_executed_total` | Counter | symbol | Trade execution rate |
| `novex_ws_active_connections` | Gauge | — | Live connection count |
| `novex_ws_connection_total` | Counter | — | Total connections |
| `novex_ws_disconnect_total` | Counter | — | Disconnect events |
| `novex_orderbook_depth` | Gauge | symbol, side | Book depth monitor |
| `novex_reconciliation_last_run_status` | Gauge | — | 0=pass, 1=fail, 2=error |
| `novex_deposit_credited_total` | Counter | asset, network | Deposit throughput |
| `novex_deposit_confirmation_duration_seconds` | Histogram | network | Confirmation time |
| `novex_withdrawal_completed_total` | Counter | asset, network | Withdrawal throughput |
| `novex_withdrawal_rejected_total` | Counter | reason | Rejection tracking |
| `novex_pending_withdrawals` | Gauge | — | Backlog monitoring |
| `novex_auth_login_total` | Counter | result | Auth activity |
| `novex_auth_register_total` | Counter | result | Registration activity |
| `novex_nodejs_*` | Various | — | Default Node.js metrics (heap, GC, event loop) |

### Backward Compatibility

The `increment()` and `observe()` methods on MetricsService still work — they delegate to the appropriate prom-client counter/histogram. Existing callers (interceptor, load tests) require no changes.

New code should use the typed fields directly:
```typescript
this.metrics.orderPlacementTotal.inc({ symbol: 'BTC_USDT', side: 'buy', type: 'limit' });
this.metrics.orderPlacementDuration.observe({ type: 'limit' }, latencyMs);
```

## Label Cardinality Safety

Every label is bounded:

| Label | Max Values | Source |
|-------|-----------|--------|
| `symbol` | ~50 | trading_pairs table |
| `side` | 2 | buy, sell |
| `type` | 2 | limit, market |
| `status_bucket` | 5 | 2xx, 3xx, 4xx, 429, 5xx |
| `method` | 5 | GET, POST, PUT, PATCH, DELETE |
| `route` | ~20 | Normalized with UUID → :id |
| `reason` | ~10 | Bounded enum |
| `asset` | ~20 | Supported assets |
| `source` | 2 | buyer_fee, seller_fee |
| `result` | 2 | success, failure |
| `network` | ~6 | bitcoin, ethereum, tron, bsc, solana, etc. |
| `mismatch_type` | 7 | MismatchType enum |

**Never** used as labels: user ID, order ID, IP address, email, trade ID.

Route normalization replaces UUIDs with `:id` to prevent cardinality explosion from dynamic path segments.

## Deployment

### Endpoints

| URL | Format | Purpose |
|-----|--------|---------|
| `GET /metrics` | Prometheus text exposition | Prometheus scraping |
| `GET /api/v1/admin/metrics` | JSON | Admin dashboard (legacy) |

### Prometheus Configuration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: novex-backend
    metrics_path: /metrics
    scrape_interval: 10s
    static_configs:
      - targets: ['backend:3000']
```

For Kubernetes:
```yaml
  - job_name: novex-backend
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        regex: novex-backend
        action: keep
```

### Docker Compose Addition

```yaml
prometheus:
  image: prom/prometheus:v2.50.0
  ports: ['9090:9090']
  volumes:
    - ./infra/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
    - ./infra/grafana/alerts/novex-alerts.yml:/etc/prometheus/alerts/novex-alerts.yml
  networks: [novex-network]

grafana:
  image: grafana/grafana:10.3.0
  ports: ['3003:3000']
  volumes:
    - ./infra/grafana/dashboards:/var/lib/grafana/dashboards
  environment:
    GF_SECURITY_ADMIN_PASSWORD: admin
  networks: [novex-network]
```

### Grafana Dashboard Import

1. Open Grafana at `http://localhost:3003`
2. Add Prometheus data source: `http://prometheus:9090`
3. Import dashboard from `infra/grafana/dashboards/novex-trading.json`

### Alert Rules

Load via Prometheus `rule_files`:
```yaml
rule_files:
  - /etc/prometheus/alerts/novex-alerts.yml
```

Or import into Grafana Alerting directly.

### Multi-Instance Deployment

Each NovEx backend pod exposes `/metrics` independently. Prometheus scrapes all pods and aggregates using standard PromQL functions:

```promql
# Total order rate across all pods
sum(rate(novex_order_placement_total[1m]))

# Per-pod latency p95
histogram_quantile(0.95, rate(novex_order_placement_duration_ms_bucket[5m]))

# Aggregated across pods
histogram_quantile(0.95, sum(rate(novex_order_placement_duration_ms_bucket[5m])) by (le))
```

No coordination between pods is needed — prom-client uses process-local counters. Prometheus handles the aggregation.

## Grafana Dashboard Panels (16 panels)

| Panel | Query | Type |
|-------|-------|------|
| Order Placement Rate | `rate(novex_order_placement_total[1m])` by symbol/side/type | Time series |
| Order Placement Latency | `histogram_quantile(0.50/0.95/0.99, ...)` | Time series |
| Match-to-Settlement Latency | `histogram_quantile(0.95/0.99, ...)` | Time series |
| Trades Executed | `rate(novex_trade_executed_total[1m])` | Time series |
| Market Order Rejections | `rate(novex_market_order_rejection_total[5m])` by reason | Time series |
| Idempotency Replays | `novex_idempotency_replay_total` | Stat |
| Cancel Failures | `novex_cancel_failure_total` | Stat |
| WebSocket Connections | active gauge + disconnect rate | Time series |
| Reconciliation Mismatches | `novex_reconciliation_mismatch_total` (red threshold at 1) | Stat |
| Treasury Fee Accrual | `rate(novex_treasury_fee_collected_total[5m])` by asset/source | Time series |
| HTTP Error Rates | 5xx and 429 rates | Time series |
| Deposits Credited | `rate(novex_deposit_credited_total[5m])` | Time series |
| Withdrawals Completed | `rate(novex_withdrawal_completed_total[5m])` | Time series |
| Auth Activity | login and register rates by result | Time series |
| Pending Withdrawals | `novex_pending_withdrawals` gauge | Stat |
| Node.js Heap | `novex_nodejs_heap_size_used_bytes` | Time series |

## Alert Summary (10 rules)

| Alert | Severity | Condition |
|-------|----------|-----------|
| ReconciliationMismatch | Critical | mismatch_total > 0 |
| NegativeBalance | Critical | last_run_status == 1 |
| DuplicateFeeLedger | Critical | missing_fee_ledger increase > 0 |
| OrderEndpoint5xxRate | High | 5xx/total > 1% for 5m |
| TreasuryFeeDrift | High | fee_ledger_treasury mismatch increase > 0 |
| OrderPlacementLatencyHigh | High | p95 > 500ms for 5m |
| WsDisconnectRateElevated | Warning | disconnect rate > 50/min for 5m |
| RateLimitSpike | Warning | 429 rate > 1/s for 5m |
| MarketOrderRejectionSpike | Warning | rejection rate > 0.5/s for 5m |
| PendingWithdrawalsBacklog | Warning | pending > 20 for 15m |
