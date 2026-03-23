'use client';

import { cn } from '@/lib/utils';

interface TradeEntry {
  price: string;
  quantity: string;
  takerSide: string;
  timestamp: number;
}

interface TradeHistoryProps {
  trades: TradeEntry[];
}

export function TradeHistory({ trades }: TradeHistoryProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="grid grid-cols-3 text-right text-[10px] font-medium text-nvx-text-muted px-3 py-1.5 border-b border-nvx-border flex-shrink-0">
        <span className="text-left">Price</span>
        <span>Amount</span>
        <span>Time</span>
      </div>

      {/* Trades list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {trades.length === 0 ? (
          <div className="flex items-center justify-center h-full text-nvx-text-muted text-xs">
            Trades will appear here in real-time
          </div>
        ) : (
          trades.slice(0, 50).map((trade, i) => (
            <div
              key={`${trade.timestamp}-${i}`}
              className="grid grid-cols-3 text-right text-[11px] font-mono py-[2px] px-3 hover:bg-nvx-bg-tertiary/30 transition-colors"
            >
              <span
                className={cn(
                  'text-left',
                  trade.takerSide === 'buy' ? 'text-nvx-buy' : 'text-nvx-sell',
                )}
              >
                {parseFloat(trade.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span className="text-nvx-text-secondary">
                {parseFloat(trade.quantity).toFixed(6)}
              </span>
              <span className="text-nvx-text-muted">
                {new Date(trade.timestamp).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false,
                })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
