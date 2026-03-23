'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface OrderBookEntry {
  price: string;
  quantity: string;
  total: string;
}

interface OrderBookProps {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  lastPrice: string;
  priceDecimals: number;
  qtyDecimals: number;
  onPriceClick?: (price: string) => void;
}

function OrderRow({
  entry,
  side,
  maxTotal,
  priceDecimals,
  qtyDecimals,
  onClick,
}: {
  entry: OrderBookEntry;
  side: 'buy' | 'sell';
  maxTotal: number;
  priceDecimals: number;
  qtyDecimals: number;
  onClick?: (price: string) => void;
}) {
  const fillPercent = maxTotal > 0 ? (parseFloat(entry.total) / maxTotal) * 100 : 0;

  return (
    <button
      onClick={() => onClick?.(entry.price)}
      className="grid grid-cols-3 w-full text-right text-[11px] font-mono py-[2px] px-2 relative hover:bg-nvx-bg-tertiary/40 transition-colors cursor-pointer"
    >
      {/* Depth fill bar */}
      <div
        className={cn(
          'absolute inset-y-0 right-0 opacity-15',
          side === 'buy' ? 'bg-nvx-buy' : 'bg-nvx-sell',
        )}
        style={{ width: `${Math.min(fillPercent, 100)}%` }}
      />

      <span className={cn('relative z-10 text-left', side === 'buy' ? 'text-nvx-buy' : 'text-nvx-sell')}>
        {parseFloat(entry.price).toFixed(priceDecimals)}
      </span>
      <span className="relative z-10 text-nvx-text-secondary">
        {parseFloat(entry.quantity).toFixed(Math.min(qtyDecimals, 4))}
      </span>
      <span className="relative z-10 text-nvx-text-muted">
        {parseFloat(entry.total).toFixed(2)}
      </span>
    </button>
  );
}

export function OrderBook({
  bids,
  asks,
  lastPrice,
  priceDecimals,
  qtyDecimals,
  onPriceClick,
}: OrderBookProps) {
  const maxAskTotal = useMemo(() => {
    if (asks.length === 0) return 0;
    return Math.max(...asks.slice(0, 15).map((a) => parseFloat(a.total)));
  }, [asks]);

  const maxBidTotal = useMemo(() => {
    if (bids.length === 0) return 0;
    return Math.max(...bids.slice(0, 15).map((b) => parseFloat(b.total)));
  }, [bids]);

  // Asks: show lowest at bottom (closest to spread)
  const displayAsks = asks.slice(0, 15).reverse();
  const displayBids = bids.slice(0, 15);

  // Spread calculation
  const bestAsk = asks.length > 0 ? parseFloat(asks[0]!.price) : 0;
  const bestBid = bids.length > 0 ? parseFloat(bids[0]!.price) : 0;
  const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;
  const spreadPct = bestAsk > 0 ? ((spread / bestAsk) * 100).toFixed(2) : '0.00';

  const lastPriceNum = parseFloat(lastPrice);
  const priceColor = lastPriceNum > 0 ? (bestBid > 0 && lastPriceNum >= bestBid ? 'text-nvx-buy' : 'text-nvx-sell') : 'text-nvx-text-primary';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="grid grid-cols-3 text-right text-[10px] font-medium text-nvx-text-muted px-2 py-1.5 border-b border-nvx-border flex-shrink-0">
        <span className="text-left">Price</span>
        <span>Amount</span>
        <span>Total</span>
      </div>

      {/* Asks (sells) - reversed so lowest ask is at bottom */}
      <div className="flex-1 overflow-hidden flex flex-col justify-end min-h-0">
        {displayAsks.map((ask, i) => (
          <OrderRow
            key={`ask-${i}`}
            entry={ask}
            side="sell"
            maxTotal={maxAskTotal}
            priceDecimals={priceDecimals}
            qtyDecimals={qtyDecimals}
            onClick={onPriceClick}
          />
        ))}
      </div>

      {/* Spread / Last price bar */}
      <div className="flex items-center justify-between py-1.5 px-2 border-y border-nvx-border bg-nvx-bg-primary/50 flex-shrink-0">
        <span className={cn('text-base font-bold font-mono', priceColor)}>
          {lastPriceNum > 0 ? lastPriceNum.toFixed(priceDecimals) : '--'}
        </span>
        <span className="text-[10px] text-nvx-text-muted">
          Spread: {spread.toFixed(priceDecimals)} ({spreadPct}%)
        </span>
      </div>

      {/* Bids (buys) */}
      <div className="flex-1 overflow-hidden min-h-0">
        {displayBids.map((bid, i) => (
          <OrderRow
            key={`bid-${i}`}
            entry={bid}
            side="buy"
            maxTotal={maxBidTotal}
            priceDecimals={priceDecimals}
            qtyDecimals={qtyDecimals}
            onClick={onPriceClick}
          />
        ))}
      </div>
    </div>
  );
}
