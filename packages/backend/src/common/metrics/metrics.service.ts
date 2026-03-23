import { Injectable, Global, OnModuleInit } from '@nestjs/common';
import * as prom from 'prom-client';

/**
 * NovEx Prometheus Metrics Service
 *
 * Process-safe instrumentation using prom-client. Each pod exposes its own
 * /metrics endpoint. Prometheus aggregates via service discovery.
 *
 * Label cardinality rules (never use unbounded values as labels):
 *   - symbol:        bounded by trading_pairs table (~10–50)
 *   - side:          'buy' | 'sell'
 *   - type:          'limit' | 'market'
 *   - status_bucket: '2xx' | '3xx' | '4xx' | '429' | '5xx'
 *   - reason:        bounded enum
 *   - asset:         bounded by supported assets (~10–20)
 *   - source:        'buyer_fee' | 'seller_fee'
 *   - result:        'success' | 'failure'
 *   - mismatch_type: enum (~7 values)
 */

@Global()
@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry = new prom.Registry();

  /* ═══ Counters ══════════════════════════════════════ */

  readonly orderPlacementTotal = new prom.Counter({
    name: 'novex_order_placement_total',
    help: 'Total orders placed',
    labelNames: ['symbol', 'side', 'type'] as const,
    registers: [this.registry],
  });

  readonly orderCancelTotal = new prom.Counter({
    name: 'novex_order_cancel_total',
    help: 'Total orders cancelled',
    labelNames: ['symbol'] as const,
    registers: [this.registry],
  });

  readonly tradeExecutedTotal = new prom.Counter({
    name: 'novex_trade_executed_total',
    help: 'Total trades executed',
    labelNames: ['symbol'] as const,
    registers: [this.registry],
  });

  readonly marketOrderRejectionTotal = new prom.Counter({
    name: 'novex_market_order_rejection_total',
    help: 'Market orders rejected',
    labelNames: ['reason'] as const,
    registers: [this.registry],
  });

  readonly slippageRejectionTotal = new prom.Counter({
    name: 'novex_slippage_rejection_total',
    help: 'Orders rejected due to slippage bound exceeded',
    registers: [this.registry],
  });

  readonly idempotencyReplayTotal = new prom.Counter({
    name: 'novex_idempotency_replay_total',
    help: 'Idempotent request replays (cached response returned)',
    registers: [this.registry],
  });

  readonly cancelFailureTotal = new prom.Counter({
    name: 'novex_cancel_failure_total',
    help: 'Failed order cancellation attempts',
    labelNames: ['reason'] as const,
    registers: [this.registry],
  });

  readonly httpRequestTotal = new prom.Counter({
    name: 'novex_http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status_bucket'] as const,
    registers: [this.registry],
  });

  readonly http5xxTotal = new prom.Counter({
    name: 'novex_http_5xx_total',
    help: 'HTTP 5xx server error responses',
    labelNames: ['method', 'route'] as const,
    registers: [this.registry],
  });

  readonly http429Total = new prom.Counter({
    name: 'novex_http_429_total',
    help: 'HTTP 429 rate-limited responses',
    labelNames: ['method', 'route'] as const,
    registers: [this.registry],
  });

  readonly wsConnectionTotal = new prom.Counter({
    name: 'novex_ws_connection_total',
    help: 'WebSocket connections established',
    registers: [this.registry],
  });

  readonly wsDisconnectTotal = new prom.Counter({
    name: 'novex_ws_disconnect_total',
    help: 'WebSocket disconnections',
    registers: [this.registry],
  });

  readonly wsReconnectTotal = new prom.Counter({
    name: 'novex_ws_reconnect_total',
    help: 'WebSocket reconnect events',
    registers: [this.registry],
  });

  readonly reconMismatchTotal = new prom.Counter({
    name: 'novex_reconciliation_mismatch_total',
    help: 'Reconciliation mismatches found',
    labelNames: ['mismatch_type'] as const,
    registers: [this.registry],
  });

  readonly treasuryFeeCollected = new prom.Counter({
    name: 'novex_treasury_fee_collected_total',
    help: 'Fees collected into platform treasury',
    labelNames: ['asset', 'source'] as const,
    registers: [this.registry],
  });

  readonly depositCreditedTotal = new prom.Counter({
    name: 'novex_deposit_credited_total',
    help: 'Deposits successfully credited to user wallets',
    labelNames: ['asset', 'network'] as const,
    registers: [this.registry],
  });

  readonly withdrawalCompletedTotal = new prom.Counter({
    name: 'novex_withdrawal_completed_total',
    help: 'Withdrawals completed on-chain',
    labelNames: ['asset', 'network'] as const,
    registers: [this.registry],
  });

  readonly withdrawalRejectedTotal = new prom.Counter({
    name: 'novex_withdrawal_rejected_total',
    help: 'Withdrawals rejected by admin or system',
    labelNames: ['reason'] as const,
    registers: [this.registry],
  });

  readonly authLoginTotal = new prom.Counter({
    name: 'novex_auth_login_total',
    help: 'Login attempts by result',
    labelNames: ['result'] as const,
    registers: [this.registry],
  });

  readonly authRegisterTotal = new prom.Counter({
    name: 'novex_auth_register_total',
    help: 'Registration attempts by result',
    labelNames: ['result'] as const,
    registers: [this.registry],
  });

  /* ═══ Histograms ════════════════════════════════════ */

  readonly httpRequestDuration = new prom.Histogram({
    name: 'novex_http_request_duration_ms',
    help: 'HTTP request duration in milliseconds',
    labelNames: ['method', 'route', 'status_bucket'] as const,
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [this.registry],
  });

  readonly orderPlacementDuration = new prom.Histogram({
    name: 'novex_order_placement_duration_ms',
    help: 'Order placement latency',
    labelNames: ['type'] as const,
    buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
    registers: [this.registry],
  });

  readonly matchToSettlementDuration = new prom.Histogram({
    name: 'novex_match_to_settlement_duration_ms',
    help: 'Time from match to completed settlement',
    buckets: [1, 5, 10, 25, 50, 100, 250, 500],
    registers: [this.registry],
  });

  readonly depositConfirmationDuration = new prom.Histogram({
    name: 'novex_deposit_confirmation_duration_seconds',
    help: 'Time from deposit detection to credited (seconds)',
    labelNames: ['network'] as const,
    buckets: [60, 120, 300, 600, 1800, 3600],
    registers: [this.registry],
  });

  /* ═══ Gauges ════════════════════════════════════════ */

  readonly wsActiveConnections = new prom.Gauge({
    name: 'novex_ws_active_connections',
    help: 'Currently active WebSocket connections',
    registers: [this.registry],
  });

  readonly orderBookDepth = new prom.Gauge({
    name: 'novex_orderbook_depth',
    help: 'Order book depth (number of levels)',
    labelNames: ['symbol', 'side'] as const,
    registers: [this.registry],
  });

  readonly reconLastRunStatus = new prom.Gauge({
    name: 'novex_reconciliation_last_run_status',
    help: '0=passed, 1=failed, 2=error',
    registers: [this.registry],
  });

  readonly pendingWithdrawals = new prom.Gauge({
    name: 'novex_pending_withdrawals',
    help: 'Number of withdrawals awaiting review',
    registers: [this.registry],
  });

  /* ═══ Lifecycle ═════════════════════════════════════ */

  onModuleInit() {
    prom.collectDefaultMetrics({
      register: this.registry,
      prefix: 'novex_',
    });
  }

  /** Prometheus text exposition format for /metrics scraping. */
  async getPrometheusMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /** Content-Type header for Prometheus scrape responses. */
  getContentType(): string {
    return this.registry.contentType;
  }

  /* ═══ Backward-compatible API ═══════════════════════
   * These methods keep the old increment()/observe() interface
   * so existing callers (interceptor, load tests) work unchanged.
   * New code should use the typed counter/histogram fields directly.
   * ═════════════════════════════════════════════════════ */

  increment(metric: string, labels?: Record<string, string>, delta = 1): void {
    switch (metric) {
      case 'order_placement_count':
        this.orderPlacementTotal.inc(labels as any ?? {}, delta); break;
      case 'order_cancel_count':
        this.orderCancelTotal.inc(labels as any ?? {}, delta); break;
      case 'market_order_rejection_count':
        this.marketOrderRejectionTotal.inc(labels as any ?? {}, delta); break;
      case 'slippage_bound_rejection_count':
        this.slippageRejectionTotal.inc(delta); break;
      case 'idempotency_replay_count':
        this.idempotencyReplayTotal.inc(delta); break;
      case 'cancel_failure_count':
        this.cancelFailureTotal.inc(labels as any ?? {}, delta); break;
      case 'http_5xx_count':
        this.http5xxTotal.inc(labels as any ?? {}, delta); break;
      case 'reconciliation_mismatch_count':
        this.reconMismatchTotal.inc(labels as any ?? {}, delta); break;
      case 'treasury_fee_collected':
        this.treasuryFeeCollected.inc(labels as any ?? {}, delta); break;
      case 'ws_reconnect_count':
        this.wsReconnectTotal.inc(delta); break;
    }
  }

  observe(metric: string, value: number, labels?: Record<string, string>): void {
    switch (metric) {
      case 'order_placement_latency_ms':
        this.orderPlacementDuration.observe(labels as any ?? {}, value); break;
      case 'match_to_settlement_latency_ms':
        this.matchToSettlementDuration.observe(value); break;
    }
  }

  /** Legacy JSON snapshot for /admin/metrics. Use /metrics for Prometheus. */
  async getSnapshot(): Promise<any> {
    return {
      collectedAt: new Date().toISOString(),
      metrics: await this.registry.getMetricsAsJSON(),
    };
  }
}
