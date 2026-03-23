'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { OrderBook } from '@/components/trading/OrderBook';
import { OrderForm } from '@/components/trading/OrderForm';
import { TradeHistory } from '@/components/trading/TradeHistory';
import { PairSelector } from '@/components/trading/PairSelector';

const PriceChart = dynamic(
  () => import('@/components/trading/PriceChart').then((mod) => mod.PriceChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-nvx-bg-secondary">
        <div className="text-center">
          <div className="animate-pulse rounded-lg bg-nvx-bg-tertiary h-[300px] w-full" />
        </div>
      </div>
    ),
  },
);

const DepthChart = dynamic(
  () => import('@/components/trading/DepthChart').then((mod) => mod.DepthChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-nvx-bg-secondary">
        <div className="animate-pulse rounded-lg bg-nvx-bg-tertiary h-full w-full" />
      </div>
    ),
  },
);
import {
  marketApi,
  tradingApi,
  walletApi,
  type TradingPairDto,
  type TickerDto,
  type OrderBookDto,
  type OrderDto,
  type BalanceDto,
} from '@/lib/api';
import {
  useMarketStream,
  useAccountStream,
} from '@/hooks/useWebSocket';
import { useIdempotentSubmit } from '@/hooks/useIdempotentSubmit';
import { generateIdempotencyKey } from '@/lib/idempotency';
import { cn } from '@/lib/utils';
import { exportToCsv } from '@/lib/csv';
import { Download } from 'lucide-react';

type Tab = 'open' | 'filled' | 'cancelled';
type BookView = 'book' | 'depth';

export default function TradePage() {
  // ── Market state ─────────────────────────────────────
  const [pairs, setPairs] = useState<TradingPairDto[]>([]);
  const [selectedPair, setSelectedPair] = useState('BTCUSDT');
  const [ticker, setTicker] = useState<TickerDto | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBookDto | null>(null);
  const [recentTrades, setRecentTrades] = useState<Array<{
    price: string; quantity: string; takerSide: string; timestamp: number;
  }>>([]);

  // ── User state ───────────────────────────────────────
  const [balances, setBalances] = useState<BalanceDto[]>([]);
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [orderTab, setOrderTab] = useState<Tab>('open');

  // ── Ticker map for all pairs (used by PairSelector) ──
  const [allTickers, setAllTickers] = useState<Record<string, { lastPrice: string; priceChangePercent24h: string }>>({});

  // ── UI state ─────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orderFormPrice, setOrderFormPrice] = useState<string | undefined>(undefined);
  const [bookView, setBookView] = useState<BookView>('book');

  // ── Idempotent submit for place order ──────────────
  const orderSubmit = useIdempotentSubmit<OrderDto>();
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());

  // ── HTTP bootstrap (runs once per pair change) ───────
  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const [pairList, tick, book, bal, ord] = await Promise.all([
        marketApi.getPairs(),
        marketApi.getTicker(selectedPair).catch(() => null),
        marketApi.getOrderBook(selectedPair, 15).catch(() => null),
        walletApi.getBalances().catch(() => []),
        tradingApi.getOrders({ symbol: selectedPair, limit: 50 }).catch(() => ({ orders: [], total: 0 })),
      ]);
      setPairs(pairList);
      if (tick) setTicker(tick);
      if (book) setOrderBook(book);
      setBalances(bal);
      setOrders(ord.orders);

      // Fetch tickers for all pairs (for PairSelector)
      if (pairList.length > 0) {
        const tickerResults = await Promise.allSettled(
          pairList.map((p) => marketApi.getTicker(p.symbol)),
        );
        const tickerMap: Record<string, { lastPrice: string; priceChangePercent24h: string }> = {};
        tickerResults.forEach((result, i) => {
          const pair = pairList[i];
          if (result.status === 'fulfilled' && result.value && pair) {
            const t = result.value;
            tickerMap[pair.symbol] = {
              lastPrice: t.lastPrice,
              priceChangePercent24h: t.priceChangePercent24h,
            };
          }
        });
        setAllTickers(tickerMap);
      }
    } catch {
      // partial failure is okay
    } finally {
      setLoading(false);
    }
  }, [selectedPair]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // ── WebSocket: public market streams ─────────────────
  useMarketStream(selectedPair, {
    onTicker(e) {
      setTicker((prev) => prev ? { ...prev, lastPrice: e.lastPrice } : prev);
      // Keep allTickers in sync for PairSelector
      setAllTickers((prev) => ({
        ...prev,
        [selectedPair]: {
          lastPrice: e.lastPrice,
          priceChangePercent24h: prev[selectedPair]?.priceChangePercent24h ?? '0',
        },
      }));
    },
    onOrderBookSnapshot(e) {
      setOrderBook({ symbol: e.symbol, bids: e.bids, asks: e.asks, timestamp: e.timestamp });
    },
    onOrderBookUpdate(e) {
      setOrderBook({ symbol: e.symbol, bids: e.bids, asks: e.asks, timestamp: e.timestamp });
    },
    onTrade(e) {
      setRecentTrades((prev) => [
        { price: e.price, quantity: e.quantity, takerSide: e.takerSide, timestamp: e.timestamp },
        ...prev.slice(0, 49),
      ]);
    },
  });

  // ── WebSocket: private account streams ───────────────
  useAccountStream({
    onOrder(e) {
      if (e.type === 'placed') {
        setOrders((prev) => [e.order, ...prev.filter((o) => o.id !== e.order.id)]);
      } else if (e.type === 'cancelled') {
        setOrders((prev) => prev.map((o) => o.id === e.order.id ? e.order : o));
      }
    },
    onFill(e) {
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== e.orderId) return o;
          return o;
        }),
      );
      tradingApi.getOrders({ symbol: selectedPair, limit: 50 })
        .then((res) => setOrders(res.orders))
        .catch(() => {});
    },
    onBalance(e) {
      setBalances(e.balances);
    },
  });

  // ── Place order handler (idempotent) ─────────────────
  const handlePlaceOrder = async (dto: {
    side: 'buy' | 'sell';
    type: 'limit' | 'market' | 'stop_limit';
    price: string;
    quantity: string;
    stopPrice?: string;
  }) => {
    setError('');
    const result = await orderSubmit.submit((key) =>
      tradingApi.placeOrder({ symbol: selectedPair, ...dto }, key),
    );

    if (result.data) {
      setTimeout(() => {
        tradingApi.getOrders({ symbol: selectedPair, limit: 50 })
          .then((res) => setOrders(res.orders)).catch(() => {});
        walletApi.getBalances().then(setBalances).catch(() => {});
      }, 500);
      setTimeout(() => orderSubmit.reset(), 3000);
    }
  };

  // ── Cancel order handler (idempotent) ────────────────
  const handleCancelOrder = async (orderId: string) => {
    if (cancellingIds.has(orderId)) return;

    const key = generateIdempotencyKey();
    setCancellingIds((prev) => new Set(prev).add(orderId));

    try {
      await tradingApi.cancelOrder(orderId, key);
      setTimeout(() => {
        tradingApi.getOrders({ symbol: selectedPair, limit: 50 })
          .then((res) => setOrders(res.orders)).catch(() => {});
        walletApi.getBalances().then(setBalances).catch(() => {});
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setCancellingIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  // ── Price click from order book ──────────────────────
  const handlePriceClick = (price: string) => {
    setOrderFormPrice(price);
  };

  // ── Derived data ─────────────────────────────────────
  const currentPair = pairs.find((p) => p.symbol === selectedPair);
  const baseAsset = currentPair?.baseCurrency ?? selectedPair.replace(/USDT$/, '');
  const quoteAsset = currentPair?.quoteCurrency ?? 'USDT';
  const quoteBalance = balances.find((b) => b.currency === quoteAsset);
  const baseBalance = balances.find((b) => b.currency === baseAsset);

  const bids = (orderBook?.bids ?? []).map(([price, qty]) => ({
    price, quantity: qty, total: String(parseFloat(price) * parseFloat(qty)),
  }));
  const asks = (orderBook?.asks ?? []).map(([price, qty]) => ({
    price, quantity: qty, total: String(parseFloat(price) * parseFloat(qty)),
  }));

  const filteredOrders = orders.filter((o) => {
    if (orderTab === 'open') return o.status === 'open' || o.status === 'partially_filled';
    if (orderTab === 'filled') return o.status === 'filled';
    return o.status === 'cancelled';
  });

  // ── CSV Export handler ──────────────────────────────
  const handleExportCsv = () => {
    const headers = ['Date', 'Pair', 'Side', 'Type', 'Price', 'Quantity', 'Filled', 'Status', 'Total'];
    const rows = filteredOrders.map((o) => [
      new Date(o.createdAt).toISOString(),
      o.symbol,
      o.side.toUpperCase(),
      o.type,
      o.price,
      o.quantity,
      o.filledQuantity,
      o.status.replace('_', ' '),
      (parseFloat(o.price) * parseFloat(o.quantity)).toFixed(2),
    ]);
    const tabLabel = orderTab === 'open' ? 'open-orders' : orderTab === 'filled' ? 'trade-history' : 'order-history';
    exportToCsv(`novex-${tabLabel}-${selectedPair}.csv`, headers, rows);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] bg-nvx-bg-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-nvx-primary border-t-transparent mx-auto mb-4" />
          <p className="text-nvx-text-secondary">Loading market data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-56px)] bg-nvx-bg-primary flex flex-col overflow-hidden">
      {/* ── Top Bar ──────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-nvx-bg-secondary border-b border-nvx-border px-4 py-2 flex items-center gap-6">
        <PairSelector
          pairs={pairs}
          selectedPair={selectedPair}
          tickers={allTickers}
          onSelectPair={setSelectedPair}
        />

        {ticker ? (
          <>
            <div>
              <span className="text-xl font-bold text-nvx-text-primary font-mono">
                {parseFloat(ticker.lastPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-nvx-text-muted ml-1">{quoteAsset}</span>
            </div>
            <div className="flex gap-4 text-xs">
              <div>
                <span className="text-nvx-text-muted">24h </span>
                <span className={parseFloat(ticker.priceChangePercent24h) >= 0 ? 'text-nvx-buy' : 'text-nvx-sell'}>
                  {parseFloat(ticker.priceChangePercent24h) >= 0 ? '+' : ''}
                  {parseFloat(ticker.priceChangePercent24h).toFixed(2)}%
                </span>
              </div>
              {ticker.highPrice24h && (
                <div>
                  <span className="text-nvx-text-muted">High </span>
                  <span className="text-nvx-text-secondary font-mono">{parseFloat(ticker.highPrice24h).toLocaleString()}</span>
                </div>
              )}
              {ticker.lowPrice24h && (
                <div>
                  <span className="text-nvx-text-muted">Low </span>
                  <span className="text-nvx-text-secondary font-mono">{parseFloat(ticker.lowPrice24h).toLocaleString()}</span>
                </div>
              )}
              <div>
                <span className="text-nvx-text-muted">Vol </span>
                <span className="text-nvx-text-secondary font-mono">{parseFloat(ticker.volume24h).toLocaleString()} {baseAsset}</span>
              </div>
            </div>
          </>
        ) : (
          <span className="text-sm text-nvx-text-muted">No trades yet</span>
        )}
      </div>

      {/* ── Main Content Grid ──────────────────────────────── */}
      <div className="flex-1 min-h-0 grid grid-cols-[1fr_280px_300px] grid-rows-[1fr_240px] gap-px">
        {/* ── Chart (top left, large) ────────────────────────── */}
        <div className="bg-nvx-bg-secondary overflow-hidden">
          <PriceChart symbol={selectedPair} />
        </div>

        {/* ── Order Book / Depth Chart (top middle) ──────────── */}
        <div className="bg-nvx-bg-secondary border-l border-nvx-border overflow-hidden flex flex-col">
          {/* Toggle tabs */}
          <div className="flex items-center border-b border-nvx-border flex-shrink-0">
            {(['book', 'depth'] as BookView[]).map((view) => (
              <button
                key={view}
                onClick={() => setBookView(view)}
                className={cn(
                  'px-3 py-1.5 text-[11px] font-medium transition-colors border-b-2',
                  bookView === view
                    ? 'text-nvx-primary border-nvx-primary'
                    : 'text-nvx-text-muted border-transparent hover:text-nvx-text-secondary',
                )}
              >
                {view === 'book' ? 'Order Book' : 'Depth'}
              </button>
            ))}
          </div>

          {/* View content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {bookView === 'book' ? (
              <OrderBook
                bids={bids}
                asks={asks}
                lastPrice={ticker?.lastPrice ?? '0'}
                priceDecimals={currentPair?.pricePrecision ?? 2}
                qtyDecimals={currentPair?.quantityPrecision ?? 6}
                onPriceClick={handlePriceClick}
              />
            ) : (
              <DepthChart bids={bids} asks={asks} />
            )}
          </div>
        </div>

        {/* ── Order Form (top right) ──────────────────────────── */}
        <div className="bg-nvx-bg-secondary border-l border-nvx-border overflow-auto row-span-2">
          {error && (
            <div className="mx-3 mt-2 bg-nvx-sell/10 border border-nvx-sell/30 text-nvx-sell text-xs rounded px-3 py-2">
              {error}
              <button onClick={() => setError('')} className="ml-2 underline">dismiss</button>
            </div>
          )}
          <OrderForm
            baseAsset={baseAsset}
            quoteAsset={quoteAsset}
            lastPrice={ticker?.lastPrice ?? '0'}
            baseBalance={baseBalance?.available ?? '0'}
            quoteBalance={quoteBalance?.available ?? '0'}
            asks={orderBook?.asks ?? []}
            bids={orderBook?.bids ?? []}
            submitState={orderSubmit.state}
            submitError={orderSubmit.lastError}
            onResetState={orderSubmit.reset}
            onSubmit={handlePlaceOrder}
            loading={orderSubmit.state === 'pending'}
            externalPrice={orderFormPrice}
          />
        </div>

        {/* ── Bottom Panel: Tabs (Orders + Trade History) ─────── */}
        <div className="col-span-2 bg-nvx-bg-secondary border-t border-nvx-border overflow-hidden flex flex-col">
          <div className="flex items-center border-b border-nvx-border flex-shrink-0">
            {(['open', 'filled', 'cancelled'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setOrderTab(tab)}
                className={cn(
                  'px-4 py-2 text-xs font-medium transition-colors border-b-2',
                  orderTab === tab
                    ? 'text-nvx-primary border-nvx-primary'
                    : 'text-nvx-text-muted border-transparent hover:text-nvx-text-secondary',
                )}
              >
                {tab === 'open' ? 'Open Orders' : tab === 'filled' ? 'Trade History' : 'Order History'}
                {tab === 'open' && (
                  <span className="ml-1 text-[10px] bg-nvx-bg-tertiary rounded px-1">
                    {orders.filter((o) => o.status === 'open' || o.status === 'partially_filled').length}
                  </span>
                )}
              </button>
            ))}
            <div className="flex-1" />
            <button
              onClick={handleExportCsv}
              disabled={filteredOrders.length === 0}
              className="flex items-center gap-1 px-2 py-1 mr-2 text-[11px] text-nvx-text-muted hover:text-nvx-text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Export orders to CSV"
            >
              <Download size={12} />
              Export CSV
            </button>
          </div>

          <div className="flex-1 overflow-auto">
            {orderTab === 'open' || orderTab === 'cancelled' ? (
              filteredOrders.length === 0 ? (
                <div className="flex items-center justify-center h-full text-nvx-text-muted text-sm">
                  No {orderTab === 'open' ? 'open' : 'cancelled'} orders
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-nvx-bg-secondary">
                    <tr className="text-nvx-text-muted border-b border-nvx-border">
                      <th className="text-left px-3 py-2 font-medium">Time</th>
                      <th className="text-left px-3 py-2 font-medium">Side</th>
                      <th className="text-right px-3 py-2 font-medium">Price</th>
                      <th className="text-right px-3 py-2 font-medium">Qty</th>
                      <th className="text-right px-3 py-2 font-medium">Filled</th>
                      <th className="text-right px-3 py-2 font-medium">Status</th>
                      {orderTab === 'open' && <th className="text-right px-3 py-2 font-medium">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((o) => (
                      <tr key={o.id} className="border-b border-nvx-border/50 hover:bg-nvx-bg-tertiary/50">
                        <td className="px-3 py-1.5 text-nvx-text-secondary">{new Date(o.createdAt).toLocaleTimeString()}</td>
                        <td className={cn('px-3 py-1.5 font-medium', o.side === 'buy' ? 'text-nvx-buy' : 'text-nvx-sell')}>{o.side.toUpperCase()}</td>
                        <td className="px-3 py-1.5 text-right text-nvx-text-primary font-mono">{parseFloat(o.price).toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-right text-nvx-text-secondary font-mono">{parseFloat(o.quantity).toFixed(6)}</td>
                        <td className="px-3 py-1.5 text-right text-nvx-text-secondary font-mono">{parseFloat(o.filledQuantity).toFixed(6)}</td>
                        <td className="px-3 py-1.5 text-right">
                          <span className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded',
                            o.status === 'open' ? 'bg-blue-500/10 text-blue-400' :
                            o.status === 'partially_filled' ? 'bg-yellow-500/10 text-yellow-400' :
                            o.status === 'filled' ? 'bg-nvx-buy/10 text-nvx-buy' :
                            'bg-gray-500/10 text-gray-400',
                          )}>{o.status.replace('_', ' ')}</span>
                        </td>
                        {orderTab === 'open' && (
                          <td className="px-3 py-1.5 text-right">
                            <button
                              onClick={() => handleCancelOrder(o.id)}
                              disabled={cancellingIds.has(o.id)}
                              className={cn(
                                'text-[10px]',
                                cancellingIds.has(o.id)
                                  ? 'text-nvx-text-muted cursor-not-allowed'
                                  : 'text-nvx-sell hover:underline',
                              )}
                            >
                              {cancellingIds.has(o.id) ? 'Cancelling...' : 'Cancel'}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : (
              /* Trade History tab */
              <TradeHistory trades={recentTrades} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
