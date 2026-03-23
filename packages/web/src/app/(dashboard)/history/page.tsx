'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  Inbox,
} from 'lucide-react';
import { tradingApi, marketApi, type OrderDto, type TradingPairDto } from '@/lib/api';
import { exportToCsv } from '@/lib/csv';
import { cn } from '@/lib/utils';

/* ─── Types ────────────────────────────────────────────── */

type Tab = 'trades' | 'orders' | 'deposits' | 'withdrawals';

const TABS: { key: Tab; label: string }[] = [
  { key: 'trades', label: 'Trade History' },
  { key: 'orders', label: 'Order History' },
  { key: 'deposits', label: 'Deposit History' },
  { key: 'withdrawals', label: 'Withdrawal History' },
];

const PAGE_SIZE = 20;

/* ─── Helpers ──────────────────────────────────────────── */

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function fmtNum(val: string | number, decimals = 8): string {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n)) return '0';
  if (n === 0) return '0';
  if (n >= 1) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: decimals });
  return n.toFixed(decimals);
}

function calcTotal(price: string, qty: string): string {
  const p = parseFloat(price) || 0;
  const q = parseFloat(qty) || 0;
  return fmtNum(p * q, 2);
}

function calcFee(total: string, feeRate = 0.001): string {
  const t = parseFloat(total) || 0;
  return fmtNum(t * feeRate, 8);
}

/* ─── Component ────────────────────────────────────────── */

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<Tab>('trades');
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pairs, setPairs] = useState<TradingPairDto[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Filters
  const [filterPair, setFilterPair] = useState('all');
  const [filterSide, setFilterSide] = useState<'all' | 'buy' | 'sell'>('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchId, setSearchId] = useState('');

  // Pagination
  const [page, setPage] = useState(0);

  // Load pairs once
  useEffect(() => {
    marketApi.getPairs().then(setPairs).catch(() => {});
  }, []);

  // Load orders when tab or page changes
  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: { symbol?: string; status?: string; limit?: number; offset?: number } = {
        limit: 50,
        offset: 0,
      };
      if (activeTab === 'trades') {
        params.status = 'filled';
      }
      if (filterPair !== 'all') {
        params.symbol = filterPair;
      }
      if (activeTab === 'orders' && filterStatus !== 'all') {
        params.status = filterStatus;
      }

      const res = await tradingApi.getOrders(params);
      setOrders(res.orders);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
      setOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [activeTab, filterPair, filterStatus]);

  useEffect(() => {
    if (activeTab === 'deposits' || activeTab === 'withdrawals') {
      setLoading(false);
      return;
    }
    setPage(0);
    loadOrders();
  }, [activeTab, loadOrders]);

  // Cancel an open order
  const handleCancel = async (orderId: string) => {
    setCancellingId(orderId);
    try {
      await tradingApi.cancelOrder(orderId);
      // Remove from list
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: 'cancelled' as const } : o)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setCancellingId(null);
    }
  };

  // Client-side filtering & sorting
  const filtered = useMemo(() => {
    let result = [...orders];

    // Side filter
    if (filterSide !== 'all') {
      result = result.filter((o) => o.side === filterSide);
    }

    // Type filter (order history only)
    if (activeTab === 'orders' && filterType !== 'all') {
      result = result.filter((o) => o.type === filterType);
    }

    // Date range
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      result = result.filter((o) => new Date(o.createdAt).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86400000; // include the full day
      result = result.filter((o) => new Date(o.createdAt).getTime() < to);
    }

    // Search by order ID
    if (searchId.trim()) {
      const q = searchId.trim().toLowerCase();
      result = result.filter((o) => o.id.toLowerCase().includes(q));
    }

    // Sort newest first
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return result;
  }, [orders, filterSide, filterType, dateFrom, dateTo, searchId, activeTab]);

  // Paginated slice
  const paginatedOrders = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // Summary stats
  const stats = useMemo(() => {
    const trades = orders.filter((o) => o.status === 'filled');
    const totalVolume = trades.reduce((sum, o) => {
      const p = parseFloat(o.price) || 0;
      const q = parseFloat(o.filledQuantity) || 0;
      return sum + p * q;
    }, 0);
    const totalFees = totalVolume * 0.001; // estimate
    return {
      totalTrades: trades.length,
      totalVolume,
      totalFees,
    };
  }, [orders]);

  // Unique pair symbols for dropdown
  const pairOptions = useMemo(() => {
    const syms = pairs.filter((p) => p.isActive).map((p) => p.symbol);
    return ['all', ...syms];
  }, [pairs]);

  // CSV export
  const handleExport = () => {
    if (activeTab === 'trades') {
      const headers = ['Date/Time', 'Pair', 'Side', 'Price', 'Quantity', 'Total', 'Fee', 'Status'];
      const rows = filtered.map((o) => {
        const total = calcTotal(o.price, o.filledQuantity);
        return [
          fmtDateTime(o.createdAt),
          o.symbol,
          o.side.toUpperCase(),
          o.price,
          o.filledQuantity,
          total,
          calcFee(total),
          o.status,
        ];
      });
      exportToCsv('trade-history.csv', headers, rows);
    } else if (activeTab === 'orders') {
      const headers = ['Date', 'Pair', 'Type', 'Side', 'Price', 'Quantity', 'Filled', 'Remaining', 'Status'];
      const rows = filtered.map((o) => {
        const filled = parseFloat(o.filledQuantity) || 0;
        const qty = parseFloat(o.quantity) || 0;
        return [
          fmtDate(o.createdAt),
          o.symbol,
          o.type,
          o.side.toUpperCase(),
          o.price,
          o.quantity,
          o.filledQuantity,
          String(qty - filled),
          o.status,
        ];
      });
      exportToCsv('order-history.csv', headers, rows);
    }
  };

  // Reset filters on tab change
  useEffect(() => {
    setFilterPair('all');
    setFilterSide('all');
    setFilterStatus('all');
    setFilterType('all');
    setDateFrom('');
    setDateTo('');
    setSearchId('');
    setPage(0);
  }, [activeTab]);

  return (
    <div className="bg-nvx-bg-primary min-h-[calc(100vh-56px)] p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-nvx-text-primary">History</h1>
            <p className="text-sm text-nvx-text-muted mt-1">View your trading and account activity</p>
          </div>
          <div className="flex items-center gap-2">
            {(activeTab === 'trades' || activeTab === 'orders') && (
              <button
                onClick={handleExport}
                disabled={filtered.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-nvx-text-secondary bg-nvx-bg-tertiary rounded-lg hover:bg-nvx-bg-tertiary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={14} />
                Export CSV
              </button>
            )}
            <button
              onClick={loadOrders}
              className="p-2 rounded-lg text-nvx-text-muted hover:text-nvx-text-primary hover:bg-nvx-bg-tertiary transition-colors"
              title="Refresh"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        {/* Summary stats (trade history / orders only) */}
        {(activeTab === 'trades' || activeTab === 'orders') && !loading && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-4">
              <p className="text-xs text-nvx-text-muted uppercase tracking-wider mb-1">Total Trades</p>
              <p className="text-lg font-bold text-nvx-text-primary font-mono">{stats.totalTrades}</p>
            </div>
            <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-4">
              <p className="text-xs text-nvx-text-muted uppercase tracking-wider mb-1">Total Volume</p>
              <p className="text-lg font-bold text-nvx-text-primary font-mono">
                ${stats.totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-4">
              <p className="text-xs text-nvx-text-muted uppercase tracking-wider mb-1">Total Fees Paid</p>
              <p className="text-lg font-bold text-nvx-text-primary font-mono">
                ${stats.totalFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl overflow-hidden">
          <div className="flex border-b border-nvx-border overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                  activeTab === tab.key
                    ? 'text-nvx-primary border-nvx-primary'
                    : 'text-nvx-text-muted border-transparent hover:text-nvx-text-primary hover:border-nvx-text-muted/30',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filters (trades / orders only) */}
          {(activeTab === 'trades' || activeTab === 'orders') && (
            <div className="p-4 border-b border-nvx-border flex flex-wrap items-center gap-3">
              {/* Search by Order ID */}
              <div className="relative flex-shrink-0">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-nvx-text-muted" />
                <input
                  type="text"
                  placeholder="Search order ID..."
                  value={searchId}
                  onChange={(e) => { setSearchId(e.target.value); setPage(0); }}
                  className="pl-8 pr-3 py-1.5 w-48 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary placeholder-nvx-text-muted focus:outline-none focus:border-nvx-primary"
                />
              </div>

              {/* Pair */}
              <select
                value={filterPair}
                onChange={(e) => { setFilterPair(e.target.value); setPage(0); }}
                className="px-3 py-1.5 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary focus:outline-none focus:border-nvx-primary"
              >
                {pairOptions.map((p) => (
                  <option key={p} value={p}>
                    {p === 'all' ? 'All Pairs' : p}
                  </option>
                ))}
              </select>

              {/* Side */}
              <select
                value={filterSide}
                onChange={(e) => { setFilterSide(e.target.value as 'all' | 'buy' | 'sell'); setPage(0); }}
                className="px-3 py-1.5 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary focus:outline-none focus:border-nvx-primary"
              >
                <option value="all">All Sides</option>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>

              {/* Status (orders only) */}
              {activeTab === 'orders' && (
                <select
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
                  className="px-3 py-1.5 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary focus:outline-none focus:border-nvx-primary"
                >
                  <option value="all">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="filled">Filled</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="partially_filled">Partially Filled</option>
                </select>
              )}

              {/* Type (orders only) */}
              {activeTab === 'orders' && (
                <select
                  value={filterType}
                  onChange={(e) => { setFilterType(e.target.value); setPage(0); }}
                  className="px-3 py-1.5 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary focus:outline-none focus:border-nvx-primary"
                >
                  <option value="all">All Types</option>
                  <option value="limit">Limit</option>
                  <option value="market">Market</option>
                  <option value="stop_limit">Stop Limit</option>
                </select>
              )}

              {/* Date range */}
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
                  className="px-2.5 py-1.5 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary focus:outline-none focus:border-nvx-primary"
                  placeholder="From"
                />
                <span className="text-nvx-text-muted text-xs">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
                  className="px-2.5 py-1.5 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary focus:outline-none focus:border-nvx-primary"
                  placeholder="To"
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mx-4 mt-4 bg-nvx-sell/10 border border-nvx-sell/30 text-nvx-sell text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Content */}
          {activeTab === 'trades' && (
            <TradeHistoryTable
              orders={paginatedOrders}
              loading={loading}
            />
          )}

          {activeTab === 'orders' && (
            <OrderHistoryTable
              orders={paginatedOrders}
              loading={loading}
              cancellingId={cancellingId}
              onCancel={handleCancel}
            />
          )}

          {activeTab === 'deposits' && <PlaceholderTab type="deposit" />}
          {activeTab === 'withdrawals' && <PlaceholderTab type="withdrawal" />}

          {/* Pagination (trades / orders only) */}
          {(activeTab === 'trades' || activeTab === 'orders') && !loading && filtered.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-nvx-border">
              <p className="text-xs text-nvx-text-muted">
                Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 rounded text-nvx-text-muted hover:text-nvx-text-primary hover:bg-nvx-bg-tertiary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs text-nvx-text-secondary px-2">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 rounded text-nvx-text-muted hover:text-nvx-text-primary hover:bg-nvx-bg-tertiary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Trade History Table ──────────────────────────────── */

function TradeHistoryTable({ orders, loading }: { orders: OrderDto[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-nvx-primary border-t-transparent mx-auto mb-3" />
          <p className="text-nvx-text-muted text-sm">Loading trade history...</p>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-nvx-text-muted">
        <Inbox size={40} className="mb-3 opacity-40" />
        <p className="text-sm font-medium">No trades found</p>
        <p className="text-xs mt-1">Your completed trades will appear here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-nvx-border text-nvx-text-muted text-xs">
            <th className="text-left py-3 px-4 font-medium">Date/Time</th>
            <th className="text-left py-3 px-4 font-medium">Pair</th>
            <th className="text-left py-3 px-4 font-medium">Side</th>
            <th className="text-right py-3 px-4 font-medium">Price</th>
            <th className="text-right py-3 px-4 font-medium">Quantity</th>
            <th className="text-right py-3 px-4 font-medium">Total</th>
            <th className="text-right py-3 px-4 font-medium">Fee</th>
            <th className="text-right py-3 px-4 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const total = calcTotal(o.price, o.filledQuantity);
            return (
              <tr key={o.id} className="border-b border-nvx-border/30 hover:bg-nvx-bg-tertiary/30 transition-colors">
                <td className="py-3 px-4 text-sm text-nvx-text-secondary whitespace-nowrap">
                  {fmtDateTime(o.createdAt)}
                </td>
                <td className="py-3 px-4 text-sm text-nvx-text-primary font-medium">{o.symbol}</td>
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
                <td className="py-3 px-4 text-right font-mono text-sm text-nvx-text-primary">{fmtNum(o.price, 2)}</td>
                <td className="py-3 px-4 text-right font-mono text-sm text-nvx-text-primary">{fmtNum(o.filledQuantity)}</td>
                <td className="py-3 px-4 text-right font-mono text-sm text-nvx-text-primary">{total}</td>
                <td className="py-3 px-4 text-right font-mono text-sm text-nvx-text-muted">{calcFee(total)}</td>
                <td className="py-3 px-4 text-right">
                  <StatusBadge status={o.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Order History Table ──────────────────────────────── */

function OrderHistoryTable({
  orders,
  loading,
  cancellingId,
  onCancel,
}: {
  orders: OrderDto[];
  loading: boolean;
  cancellingId: string | null;
  onCancel: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-nvx-primary border-t-transparent mx-auto mb-3" />
          <p className="text-nvx-text-muted text-sm">Loading order history...</p>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-nvx-text-muted">
        <Inbox size={40} className="mb-3 opacity-40" />
        <p className="text-sm font-medium">No orders found</p>
        <p className="text-xs mt-1">Your orders will appear here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-nvx-border text-nvx-text-muted text-xs">
            <th className="text-left py-3 px-4 font-medium">Date</th>
            <th className="text-left py-3 px-4 font-medium">Pair</th>
            <th className="text-left py-3 px-4 font-medium">Type</th>
            <th className="text-left py-3 px-4 font-medium">Side</th>
            <th className="text-right py-3 px-4 font-medium">Price</th>
            <th className="text-right py-3 px-4 font-medium">Quantity</th>
            <th className="text-right py-3 px-4 font-medium">Filled</th>
            <th className="text-right py-3 px-4 font-medium">Remaining</th>
            <th className="text-center py-3 px-4 font-medium">Status</th>
            <th className="text-center py-3 px-4 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const qty = parseFloat(o.quantity) || 0;
            const filled = parseFloat(o.filledQuantity) || 0;
            const remaining = qty - filled;
            const isOpen = o.status === 'open' || o.status === 'partially_filled';

            return (
              <tr key={o.id} className="border-b border-nvx-border/30 hover:bg-nvx-bg-tertiary/30 transition-colors">
                <td className="py-3 px-4 text-sm text-nvx-text-secondary whitespace-nowrap">
                  {fmtDate(o.createdAt)}
                </td>
                <td className="py-3 px-4 text-sm text-nvx-text-primary font-medium">{o.symbol}</td>
                <td className="py-3 px-4 text-sm text-nvx-text-secondary capitalize">{o.type.replace('_', ' ')}</td>
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
                <td className="py-3 px-4 text-right font-mono text-sm text-nvx-text-primary">{fmtNum(o.price, 2)}</td>
                <td className="py-3 px-4 text-right font-mono text-sm text-nvx-text-primary">{fmtNum(o.quantity)}</td>
                <td className="py-3 px-4 text-right font-mono text-sm text-nvx-text-primary">{fmtNum(o.filledQuantity)}</td>
                <td className="py-3 px-4 text-right font-mono text-sm text-nvx-text-muted">{fmtNum(remaining)}</td>
                <td className="py-3 px-4 text-center">
                  <StatusBadge status={o.status} />
                </td>
                <td className="py-3 px-4 text-center">
                  {isOpen ? (
                    <button
                      onClick={() => onCancel(o.id)}
                      disabled={cancellingId === o.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-nvx-sell bg-nvx-sell/10 rounded hover:bg-nvx-sell/20 transition-colors disabled:opacity-50"
                    >
                      {cancellingId === o.id ? (
                        <div className="animate-spin rounded-full h-3 w-3 border border-nvx-sell border-t-transparent" />
                      ) : (
                        <X size={12} />
                      )}
                      Cancel
                    </button>
                  ) : (
                    <span className="text-nvx-text-muted text-xs">--</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Status Badge ─────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    filled: 'text-nvx-buy bg-nvx-buy/10',
    open: 'text-nvx-primary bg-nvx-primary/10',
    partially_filled: 'text-yellow-400 bg-yellow-400/10',
    cancelled: 'text-nvx-text-muted bg-nvx-bg-tertiary',
  };

  return (
    <span
      className={cn(
        'text-[10px] font-medium uppercase px-2 py-0.5 rounded whitespace-nowrap',
        styles[status] ?? 'text-nvx-text-muted bg-nvx-bg-tertiary',
      )}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

/* ─── Placeholder Tabs ─────────────────────────────────── */

function PlaceholderTab({ type }: { type: 'deposit' | 'withdrawal' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-nvx-text-muted">
      <Clock size={40} className="mb-3 opacity-40" />
      <p className="text-sm font-medium">No {type} history</p>
      <p className="text-xs mt-1 text-nvx-text-muted">
        {type.charAt(0).toUpperCase() + type.slice(1)} history tracking is coming soon.
      </p>
    </div>
  );
}
