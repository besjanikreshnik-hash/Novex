'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Activity,
  Coins,
  BarChart3,
  Layers,
} from 'lucide-react';

const DonutChart = dynamic(
  () => import('@/components/portfolio/DonutChart').then((mod) => mod.DonutChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center">
        <div className="animate-pulse rounded-full bg-nvx-bg-tertiary w-[220px] h-[220px]" />
      </div>
    ),
  },
);
import {
  walletApi,
  marketApi,
  tradingApi,
  type BalanceDto,
  type TradingPairDto,
  type TickerDto,
  type OrderDto,
} from '@/lib/api';
import { cn } from '@/lib/utils';

/* ─── Types ────────────────────────────────────────────── */

interface HoldingRow {
  currency: string;
  balance: number;
  price: number;
  value: number;
  allocation: number;
  change24h: number;
}

/* ─── Donut chart colors ───────────────────────────────── */

const CHART_COLORS = [
  '#6366f1', // indigo
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#64748b', // slate (Other)
];

/* ─── Helpers ──────────────────────────────────────────── */

function fmtUsd(val: number): string {
  return val.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtNum(val: number, decimals = 8): string {
  if (val === 0) return '0';
  if (val >= 1) return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: decimals });
  return val.toFixed(decimals);
}

function fmtPercent(val: number): string {
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/* ─── Main Component ───────────────────────────────────── */

export default function PortfolioPage() {
  const [balances, setBalances] = useState<BalanceDto[]>([]);
  const [pairs, setPairs] = useState<TradingPairDto[]>([]);
  const [tickers, setTickers] = useState<Record<string, TickerDto>>({});
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [bal, pairList, orderRes] = await Promise.all([
        walletApi.getBalances(),
        marketApi.getPairs().catch(() => [] as TradingPairDto[]),
        tradingApi.getOrders({ limit: 50 }).catch(() => ({ orders: [] as OrderDto[], total: 0 })),
      ]);

      setBalances(bal);
      setPairs(pairList);
      setOrders(orderRes.orders);
      setTotalOrders(orderRes.total);

      // Fetch tickers for all active USDT pairs
      const usdtPairs = pairList.filter((p) => p.quoteCurrency === 'USDT' && p.isActive);
      const tickerMap: Record<string, TickerDto> = {};
      if (usdtPairs.length > 0) {
        const results = await Promise.allSettled(
          usdtPairs.map((p) => marketApi.getTicker(p.symbol)),
        );
        results.forEach((result, i) => {
          const pair = usdtPairs[i];
          if (result.status === 'fulfilled' && result.value && pair) {
            tickerMap[pair.baseCurrency] = result.value;
          }
        });
      }
      setTickers(tickerMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ─── Derived data ─────────────────────────────────── */

  const prices: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = { USDT: 1 };
    for (const [currency, ticker] of Object.entries(tickers)) {
      map[currency] = parseFloat(ticker.lastPrice) || 0;
    }
    return map;
  }, [tickers]);

  const changes: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [currency, ticker] of Object.entries(tickers)) {
      map[currency] = parseFloat(ticker.priceChangePercent24h) || 0;
    }
    return map;
  }, [tickers]);

  // Holdings sorted by value
  const holdings: HoldingRow[] = useMemo(() => {
    const rows = balances
      .map((b) => {
        const balance = parseFloat(b.total) || 0;
        const price = prices[b.currency] ?? 0;
        const value = balance * price;
        return {
          currency: b.currency,
          balance,
          price,
          value,
          allocation: 0,
          change24h: changes[b.currency] ?? 0,
        };
      })
      .filter((r) => r.balance > 0)
      .sort((a, b) => b.value - a.value);

    const totalValue = rows.reduce((s, r) => s + r.value, 0);
    rows.forEach((r) => {
      r.allocation = totalValue > 0 ? (r.value / totalValue) * 100 : 0;
    });
    return rows;
  }, [balances, prices, changes]);

  const totalPortfolioValue = useMemo(
    () => holdings.reduce((s, h) => s + h.value, 0),
    [holdings],
  );

  // 24h change: weighted average of per-asset changes
  const portfolio24hChange = useMemo(() => {
    if (totalPortfolioValue === 0) return { amount: 0, percent: 0 };
    let weightedChange = 0;
    holdings.forEach((h) => {
      if (h.value > 0 && h.change24h !== 0) {
        const weight = h.value / totalPortfolioValue;
        weightedChange += weight * h.change24h;
      }
    });
    const changeAmount = totalPortfolioValue * (weightedChange / 100);
    return { amount: changeAmount, percent: weightedChange };
  }, [holdings, totalPortfolioValue]);

  // Donut chart slices: group < 1% into "Other"
  const donutSlices = useMemo(() => {
    const major: { label: string; value: number; color: string; percent: number }[] = [];
    let otherValue = 0;
    let otherPercent = 0;

    holdings.forEach((h, i) => {
      if (h.allocation < 1) {
        otherValue += h.value;
        otherPercent += h.allocation;
      } else {
        major.push({
          label: h.currency,
          value: h.value,
          color: CHART_COLORS[major.length % CHART_COLORS.length],
          percent: h.allocation,
        });
      }
    });

    if (otherValue > 0) {
      major.push({
        label: 'Other',
        value: otherValue,
        color: CHART_COLORS[9],
        percent: otherPercent,
      });
    }

    return major;
  }, [holdings]);

  // Trading stats
  const tradingStats = useMemo(() => {
    const filled = orders.filter((o) => o.status === 'filled');
    const totalVolume = filled.reduce((sum, o) => {
      return sum + (parseFloat(o.price) || 0) * (parseFloat(o.filledQuantity) || 0);
    }, 0);
    const totalFees = totalVolume * 0.001;
    return {
      totalTrades: totalOrders,
      totalVolume,
      totalFees,
      assetsHeld: holdings.length,
    };
  }, [orders, totalOrders, holdings]);

  // Recent activity: last 10 orders
  const recentOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }, [orders]);

  /* ─── Loading state ────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] bg-nvx-bg-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-nvx-primary border-t-transparent mx-auto mb-4" />
          <p className="text-nvx-text-secondary text-sm">Loading portfolio...</p>
        </div>
      </div>
    );
  }

  /* ─── Render ───────────────────────────────────────── */

  const isPositive = portfolio24hChange.percent >= 0;

  return (
    <div className="bg-nvx-bg-primary min-h-[calc(100vh-56px)] p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-nvx-text-primary">Portfolio</h1>
            <p className="text-sm text-nvx-text-muted mt-1">Analytics & performance overview</p>
          </div>
          <button
            onClick={loadData}
            className="p-2 rounded-lg text-nvx-text-muted hover:text-nvx-text-primary hover:bg-nvx-bg-tertiary transition-colors self-start"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {error && (
          <div className="bg-nvx-sell/10 border border-nvx-sell/30 text-nvx-sell text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* ── Portfolio Overview Card ────────────────────── */}
        <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-5 mb-6">
          <p className="text-xs text-nvx-text-muted uppercase tracking-wider mb-1">
            Total Portfolio Value
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-nvx-text-primary font-mono">
            {fmtUsd(totalPortfolioValue)}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {isPositive ? (
              <TrendingUp size={14} className="text-nvx-buy" />
            ) : (
              <TrendingDown size={14} className="text-nvx-sell" />
            )}
            <span
              className={cn(
                'text-sm font-medium font-mono',
                isPositive ? 'text-nvx-buy' : 'text-nvx-sell',
              )}
            >
              {fmtUsd(Math.abs(portfolio24hChange.amount))} ({fmtPercent(portfolio24hChange.percent)})
            </span>
            <span className="text-xs text-nvx-text-muted">24h</span>
          </div>
        </div>

        {/* ── Asset Allocation + Performance Stats ───────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Donut Chart */}
          <div className="lg:col-span-1 bg-nvx-bg-secondary border border-nvx-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-nvx-text-primary mb-4">Asset Allocation</h2>
            {donutSlices.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-nvx-text-muted text-sm">
                No assets to display
              </div>
            ) : (
              <>
                <div className="flex justify-center mb-4">
                  <DonutChart slices={donutSlices} />
                </div>
                {/* Legend */}
                <div className="space-y-2">
                  {donutSlices.map((slice, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: slice.color }}
                        />
                        <span className="text-nvx-text-secondary">{slice.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-nvx-text-muted font-mono text-xs">
                          {slice.percent.toFixed(1)}%
                        </span>
                        <span className="text-nvx-text-primary font-mono text-xs">
                          {fmtUsd(slice.value)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Performance Stats Cards */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-2 gap-4">
            <StatCard
              icon={<Activity size={18} />}
              label="Total Trades"
              value={tradingStats.totalTrades.toLocaleString()}
            />
            <StatCard
              icon={<BarChart3 size={18} />}
              label="Total Volume"
              value={fmtUsd(tradingStats.totalVolume)}
            />
            <StatCard
              icon={<Coins size={18} />}
              label="Total Fees Paid"
              value={fmtUsd(tradingStats.totalFees)}
            />
            <StatCard
              icon={<Layers size={18} />}
              label="Assets Held"
              value={String(tradingStats.assetsHeld)}
            />
          </div>
        </div>

        {/* ── Holdings Table ─────────────────────────────── */}
        <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-nvx-border">
            <h2 className="text-sm font-semibold text-nvx-text-primary">Holdings</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-nvx-border text-nvx-text-muted text-xs">
                  <th className="text-left py-3 px-4 font-medium">Asset</th>
                  <th className="text-right py-3 px-4 font-medium">Balance</th>
                  <th className="text-right py-3 px-4 font-medium">Price</th>
                  <th className="text-right py-3 px-4 font-medium">Value</th>
                  <th className="text-right py-3 px-4 font-medium">Allocation</th>
                  <th className="text-right py-3 px-4 font-medium">24h Change</th>
                  <th className="text-right py-3 px-4 font-medium">Trend</th>
                </tr>
              </thead>
              <tbody>
                {holdings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-nvx-text-muted text-sm">
                      No holdings found. Deposit or trade to get started.
                    </td>
                  </tr>
                ) : (
                  holdings.map((h) => {
                    const changePositive = h.change24h >= 0;
                    return (
                      <tr
                        key={h.currency}
                        className="border-b border-nvx-border/30 hover:bg-nvx-bg-tertiary/30 transition-colors"
                      >
                        {/* Asset */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-nvx-primary/20 flex items-center justify-center text-nvx-primary text-xs font-bold flex-shrink-0">
                              {h.currency.slice(0, 1)}
                            </div>
                            <span className="font-medium text-nvx-text-primary text-sm">
                              {h.currency}
                            </span>
                          </div>
                        </td>

                        {/* Balance */}
                        <td className="py-3 px-4 text-right font-mono text-sm text-nvx-text-primary">
                          {fmtNum(h.balance)}
                        </td>

                        {/* Price */}
                        <td className="py-3 px-4 text-right font-mono text-sm text-nvx-text-secondary">
                          {h.price > 0 ? fmtUsd(h.price) : '--'}
                        </td>

                        {/* Value */}
                        <td className="py-3 px-4 text-right font-mono text-sm text-nvx-text-primary font-medium">
                          {h.value > 0 ? fmtUsd(h.value) : '--'}
                        </td>

                        {/* Allocation */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-nvx-bg-tertiary rounded-full overflow-hidden">
                              <div
                                className="h-full bg-nvx-primary rounded-full transition-all"
                                style={{ width: `${Math.min(h.allocation, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-nvx-text-muted font-mono w-12 text-right">
                              {h.allocation.toFixed(1)}%
                            </span>
                          </div>
                        </td>

                        {/* 24h Change */}
                        <td className="py-3 px-4 text-right">
                          <span
                            className={cn(
                              'text-sm font-mono font-medium',
                              h.change24h === 0
                                ? 'text-nvx-text-muted'
                                : changePositive
                                  ? 'text-nvx-buy'
                                  : 'text-nvx-sell',
                            )}
                          >
                            {h.change24h !== 0 ? fmtPercent(h.change24h) : '--'}
                          </span>
                        </td>

                        {/* Sparkline placeholder */}
                        <td className="py-3 px-4 text-right">
                          <SparklinePlaceholder positive={changePositive} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Recent Activity ────────────────────────────── */}
        <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-nvx-border">
            <h2 className="text-sm font-semibold text-nvx-text-primary">Recent Activity</h2>
          </div>
          {recentOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-nvx-text-muted">
              <Activity size={32} className="mb-2 opacity-40" />
              <p className="text-sm">No recent activity</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-nvx-border text-nvx-text-muted text-xs">
                    <th className="text-left py-3 px-4 font-medium">Date</th>
                    <th className="text-left py-3 px-4 font-medium">Pair</th>
                    <th className="text-left py-3 px-4 font-medium">Side</th>
                    <th className="text-right py-3 px-4 font-medium">Amount</th>
                    <th className="text-right py-3 px-4 font-medium">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => (
                    <tr
                      key={o.id}
                      className="border-b border-nvx-border/30 hover:bg-nvx-bg-tertiary/30 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-nvx-text-secondary whitespace-nowrap">
                        {fmtDateTime(o.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-sm text-nvx-text-primary font-medium">
                        {o.symbol}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            'text-xs font-semibold uppercase px-2 py-0.5 rounded',
                            o.side === 'buy'
                              ? 'text-nvx-buy bg-nvx-buy/10'
                              : 'text-nvx-sell bg-nvx-sell/10',
                          )}
                        >
                          {o.side}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm text-nvx-text-primary">
                        {fmtNum(parseFloat(o.quantity) || 0)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm text-nvx-text-secondary">
                        {fmtUsd(parseFloat(o.price) || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Stat Card ────────────────────────────────────────── */

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-nvx-primary">{icon}</div>
        <p className="text-xs text-nvx-text-muted uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-lg font-bold text-nvx-text-primary font-mono">{value}</p>
    </div>
  );
}

/* ─── Sparkline Placeholder ────────────────────────────── */

function SparklinePlaceholder({ positive }: { positive: boolean }) {
  const color = positive ? '#22c55e' : '#ef4444';
  // Simple SVG sparkline placeholder with random-looking path
  const d = positive
    ? 'M0,12 L6,10 L12,11 L18,7 L24,8 L30,4 L36,5 L42,2'
    : 'M0,2 L6,4 L12,3 L18,7 L24,6 L30,10 L36,9 L42,12';

  return (
    <svg width="42" height="14" viewBox="0 0 42 14" className="inline-block ml-auto">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
