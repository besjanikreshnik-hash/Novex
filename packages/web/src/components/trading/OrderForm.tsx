'use client';

import { useState, useMemo, useEffect } from 'react';
import Decimal from 'decimal.js';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export type OrderSubmitState = 'idle' | 'pending' | 'confirmed' | 'failed';

interface OrderFormProps {
  baseAsset: string;
  quoteAsset: string;
  lastPrice: string;
  baseBalance: string;
  quoteBalance: string;
  asks?: [string, string][];
  bids?: [string, string][];
  loading?: boolean;
  /** Submission state from parent (drives UI feedback) */
  submitState?: OrderSubmitState;
  /** Error message from parent (displayed in form) */
  submitError?: string | null;
  /** Called when user wants to dismiss the confirmed/failed banner */
  onResetState?: () => void;
  onSubmit: (order: {
    side: 'buy' | 'sell';
    type: 'limit' | 'market' | 'stop_limit' | 'trailing_stop';
    price: string;
    quantity: string;
    stopPrice?: string;
    trailingDelta?: string;
    trailingActivationPrice?: string;
  }) => void;
  onSubmitOCO?: (order: {
    side: 'buy' | 'sell';
    symbol?: string;
    limitPrice: string;
    limitQuantity: string;
    stopPrice: string;
    stopQuantity: string;
  }) => void;
  /** External price set from order book click */
  externalPrice?: string;
}

const percentages = [25, 50, 75, 100] as const;

export function OrderForm({
  baseAsset,
  quoteAsset,
  lastPrice,
  baseBalance,
  quoteBalance,
  asks = [],
  bids = [],
  loading = false,
  submitState = 'idle',
  submitError = null,
  onResetState,
  onSubmit,
  onSubmitOCO,
  externalPrice,
}: OrderFormProps) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [type, setType] = useState<'limit' | 'market' | 'stop_limit' | 'oco' | 'trailing'>('limit');
  const [price, setPrice] = useState(lastPrice !== '0' ? lastPrice : '');
  const [stopPrice, setStopPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedPercent, setSelectedPercent] = useState<number | null>(null);

  // OCO-specific fields
  const [ocoLimitPrice, setOcoLimitPrice] = useState('');
  const [ocoLimitQty, setOcoLimitQty] = useState('');
  const [ocoStopPrice, setOcoStopPrice] = useState('');
  const [ocoStopQty, setOcoStopQty] = useState('');

  // Trailing stop fields
  const [trailingDelta, setTrailingDelta] = useState('');
  const [trailingActivationPrice, setTrailingActivationPrice] = useState('');

  // Sync external price from order book click
  useEffect(() => {
    if (externalPrice) {
      setPrice(externalPrice);
      setType('limit');
    }
  }, [externalPrice]);

  const isMarket = type === 'market';
  const isOCO = type === 'oco';
  const isTrailing = type === 'trailing';
  const availableBalance = side === 'buy' ? quoteBalance : baseBalance;

  // ── Market order fill estimation ─────────────────────
  const fillEstimate = useMemo(() => {
    if (!isMarket || !amount || parseFloat(amount) <= 0) {
      return null;
    }

    const levels = side === 'buy' ? asks : bids;
    if (levels.length === 0) return { avgPrice: '0', total: '0', fillable: '0', hasLiquidity: false };

    let remaining = new Decimal(amount);
    let totalCost = new Decimal(0);
    let totalFilled = new Decimal(0);

    for (const [priceStr, qtyStr] of levels) {
      if (remaining.lte(0)) break;
      const levelPrice = new Decimal(priceStr);
      const levelQty = new Decimal(qtyStr);
      const fillQty = Decimal.min(remaining, levelQty);
      totalCost = totalCost.plus(levelPrice.times(fillQty));
      totalFilled = totalFilled.plus(fillQty);
      remaining = remaining.minus(fillQty);
    }

    const avgPrice = totalFilled.gt(0) ? totalCost.div(totalFilled) : new Decimal(0);
    const lastPriceDec = new Decimal(lastPrice || '1');
    const slippage = lastPriceDec.gt(0) ? avgPrice.minus(lastPriceDec).div(lastPriceDec).times(100) : new Decimal(0);

    return {
      avgPrice: avgPrice.toFixed(2),
      total: totalCost.toFixed(2),
      fillable: totalFilled.toFixed(8),
      hasLiquidity: totalFilled.gt(0),
      isPartial: remaining.gt(0),
      slippagePercent: slippage.abs().toFixed(2),
      slippageDirection: side === 'buy' ? (slippage.gt(0) ? 'worse' : 'better') : (slippage.lt(0) ? 'worse' : 'better'),
    };
  }, [isMarket, amount, side, asks, bids, lastPrice]);

  // ── Limit order total ────────────────────────────────
  const limitTotal = useMemo(() => {
    if (isMarket) return '0.00';
    try {
      const p = new Decimal(price || 0);
      const a = new Decimal(amount || 0);
      return p.mul(a).toFixed(2);
    } catch {
      return '0.00';
    }
  }, [price, amount, isMarket]);

  const handlePercentClick = (pct: number) => {
    setSelectedPercent(pct);
    try {
      const balance = new Decimal(availableBalance);
      const priceDec = isMarket
        ? new Decimal(lastPrice || 1)
        : new Decimal(price || lastPrice || 1);

      if (side === 'buy') {
        const maxAmount = balance.mul(pct).div(100).div(priceDec);
        setAmount(maxAmount.toFixed(6));
      } else {
        const maxAmount = balance.mul(pct).div(100);
        setAmount(maxAmount.toFixed(6));
      }
    } catch {
      // ignore
    }
  };

  // ── Submission validation ────────────────────────────
  const canSubmit = useMemo(() => {
    if (isOCO) {
      return (
        !!ocoLimitPrice && parseFloat(ocoLimitPrice) > 0 &&
        !!ocoLimitQty && parseFloat(ocoLimitQty) > 0 &&
        !!ocoStopPrice && parseFloat(ocoStopPrice) > 0 &&
        !!ocoStopQty && parseFloat(ocoStopQty) > 0
      );
    }
    if (isTrailing) {
      return (
        !!amount && parseFloat(amount) > 0 &&
        !!trailingDelta && parseFloat(trailingDelta) > 0
      );
    }
    if (!amount || parseFloat(amount) <= 0) return false;
    if (!isMarket && (!price || parseFloat(price) <= 0)) return false;
    if (type === 'stop_limit' && (!stopPrice || parseFloat(stopPrice) <= 0)) return false;
    if (isMarket && fillEstimate && !fillEstimate.hasLiquidity) return false;
    return true;
  }, [amount, price, stopPrice, type, isMarket, isOCO, isTrailing, fillEstimate, ocoLimitPrice, ocoLimitQty, ocoStopPrice, ocoStopQty, trailingDelta]);

  const handleSubmit = () => {
    if (!canSubmit) return;

    if (isOCO) {
      onSubmitOCO?.({
        side,
        limitPrice: ocoLimitPrice,
        limitQuantity: ocoLimitQty,
        stopPrice: ocoStopPrice,
        stopQuantity: ocoStopQty,
      });
      setOcoLimitPrice('');
      setOcoLimitQty('');
      setOcoStopPrice('');
      setOcoStopQty('');
      return;
    }

    if (isTrailing) {
      onSubmit({
        side,
        type: 'trailing_stop',
        price: trailingActivationPrice || '0',
        quantity: amount,
        trailingDelta,
        trailingActivationPrice: trailingActivationPrice || undefined,
      });
      setAmount('');
      setTrailingDelta('');
      setTrailingActivationPrice('');
      setSelectedPercent(null);
      return;
    }

    const effectivePrice = isMarket
      ? (fillEstimate?.avgPrice ?? lastPrice)
      : price;

    onSubmit({
      side,
      type,
      price: effectivePrice,
      quantity: amount,
      ...(type === 'stop_limit' ? { stopPrice } : {}),
    });

    setAmount('');
    setStopPrice('');
    setSelectedPercent(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Buy / Sell tabs */}
      <div className="flex border-b border-nvx-border">
        <button
          onClick={() => setSide('buy')}
          className={cn(
            'flex-1 py-2.5 text-sm font-semibold transition-colors',
            side === 'buy'
              ? 'text-nvx-buy border-b-2 border-nvx-buy bg-nvx-buy/5'
              : 'text-nvx-text-muted hover:text-nvx-text-secondary',
          )}
        >
          Buy
        </button>
        <button
          onClick={() => setSide('sell')}
          className={cn(
            'flex-1 py-2.5 text-sm font-semibold transition-colors',
            side === 'sell'
              ? 'text-nvx-sell border-b-2 border-nvx-sell bg-nvx-sell/5'
              : 'text-nvx-text-muted hover:text-nvx-text-secondary',
          )}
        >
          Sell
        </button>
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Order type toggle */}
        <div className="flex gap-1 bg-nvx-bg-primary rounded-lg p-0.5">
          {(['limit', 'market', 'stop_limit', 'oco', 'trailing'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn(
                'flex-1 py-1.5 text-xs font-medium rounded-md transition-colors',
                type === t
                  ? 'bg-nvx-bg-tertiary text-nvx-text-primary'
                  : 'text-nvx-text-muted hover:text-nvx-text-secondary',
              )}
            >
              {t === 'stop_limit' ? 'Stop' : t === 'oco' ? 'OCO' : t === 'trailing' ? 'Trail' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Available balance */}
        <div className="flex justify-between text-xs">
          <span className="text-nvx-text-muted">Available</span>
          <span className="text-nvx-text-secondary font-mono">
            {parseFloat(availableBalance).toLocaleString()} {side === 'buy' ? quoteAsset : baseAsset}
          </span>
        </div>

        {/* Stop price input — stop_limit only */}
        {type === 'stop_limit' && (
          <Input
            label="Stop Price"
            type="number"
            placeholder="Trigger price"
            value={stopPrice}
            onChange={(e) => setStopPrice(e.target.value)}
            suffix={quoteAsset}
          />
        )}

        {/* Price input — limit and stop_limit */}
        {!isMarket && !isOCO && !isTrailing && (
          <Input
            label={type === 'stop_limit' ? 'Limit Price' : 'Price'}
            type="number"
            placeholder="0.00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            suffix={quoteAsset}
          />
        )}

        {/* OCO form fields */}
        {isOCO && (
          <>
            <div className="text-xs text-nvx-text-muted font-medium">Limit Leg</div>
            <Input
              label="Limit Price"
              type="number"
              placeholder="0.00"
              value={ocoLimitPrice}
              onChange={(e) => setOcoLimitPrice(e.target.value)}
              suffix={quoteAsset}
            />
            <Input
              label="Limit Quantity"
              type="number"
              placeholder="0.000000"
              value={ocoLimitQty}
              onChange={(e) => setOcoLimitQty(e.target.value)}
              suffix={baseAsset}
            />
            <div className="text-xs text-nvx-text-muted font-medium mt-1">Stop Leg</div>
            <Input
              label="Stop Price"
              type="number"
              placeholder="0.00"
              value={ocoStopPrice}
              onChange={(e) => setOcoStopPrice(e.target.value)}
              suffix={quoteAsset}
            />
            <Input
              label="Stop Quantity"
              type="number"
              placeholder="0.000000"
              value={ocoStopQty}
              onChange={(e) => setOcoStopQty(e.target.value)}
              suffix={baseAsset}
            />
          </>
        )}

        {/* Trailing stop form fields */}
        {isTrailing && (
          <>
            <Input
              label="Trailing Delta"
              type="number"
              placeholder="Price distance"
              value={trailingDelta}
              onChange={(e) => setTrailingDelta(e.target.value)}
              suffix={quoteAsset}
            />
            <Input
              label="Activation Price (optional)"
              type="number"
              placeholder="Auto-activate at this price"
              value={trailingActivationPrice}
              onChange={(e) => setTrailingActivationPrice(e.target.value)}
              suffix={quoteAsset}
            />
          </>
        )}

        {/* Market order info box */}
        {isMarket && (
          <div className="rounded-lg bg-nvx-bg-primary border border-nvx-border p-3">
            <div className="text-xs text-nvx-text-muted text-center">
              Market Price — executes at best available
            </div>
            {fillEstimate && fillEstimate.hasLiquidity && amount && (
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-nvx-text-muted">Est. avg price</span>
                  <span className="text-nvx-text-primary font-mono">{fillEstimate.avgPrice} {quoteAsset}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-nvx-text-muted">Est. total</span>
                  <span className="text-nvx-text-primary font-mono">{fillEstimate.total} {quoteAsset}</span>
                </div>
                {parseFloat(fillEstimate.slippagePercent!) > 0.1 && (
                  <div className="flex justify-between">
                    <span className="text-nvx-text-muted">Est. slippage</span>
                    <span className={cn(
                      'font-mono',
                      fillEstimate.slippageDirection === 'worse' ? 'text-nvx-sell' : 'text-nvx-buy',
                    )}>
                      {fillEstimate.slippagePercent}%
                    </span>
                  </div>
                )}
              </div>
            )}
            {fillEstimate && !fillEstimate.hasLiquidity && amount && (
              <div className="mt-2 text-xs text-nvx-sell text-center">
                No liquidity available
              </div>
            )}
            {fillEstimate?.isPartial && (
              <div className="mt-2 text-xs text-nvx-warning text-center">
                Partial fill — only {fillEstimate.fillable} {baseAsset} available
              </div>
            )}
          </div>
        )}

        {/* Amount input — hidden for OCO (has its own qty fields) */}
        {!isOCO && (
          <Input
            label="Amount"
            type="number"
            placeholder="0.000000"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setSelectedPercent(null);
            }}
            suffix={baseAsset}
          />
        )}

        {/* Percentage buttons */}
        {!isOCO && <div className="flex gap-1.5">
          {percentages.map((pct) => (
            <button
              key={pct}
              onClick={() => handlePercentClick(pct)}
              className={cn(
                'flex-1 py-1 text-[10px] font-medium rounded transition-colors',
                selectedPercent === pct
                  ? side === 'buy'
                    ? 'bg-nvx-buy/20 text-nvx-buy border border-nvx-buy/30'
                    : 'bg-nvx-sell/20 text-nvx-sell border border-nvx-sell/30'
                  : 'bg-nvx-bg-tertiary text-nvx-text-muted hover:text-nvx-text-secondary border border-transparent',
              )}
            >
              {pct}%
            </button>
          ))}
        </div>}

        {/* Total / slippage warning */}
        <div className="flex justify-between items-center py-2 border-t border-nvx-border">
          <span className="text-xs text-nvx-text-muted">
            {isMarket ? 'Est. Total' : 'Total'}
          </span>
          <span className="text-sm font-mono text-nvx-text-primary">
            {isMarket ? (fillEstimate?.total ?? '0.00') : limitTotal} {quoteAsset}
          </span>
        </div>

        {/* Slippage warning banner */}
        {isMarket && fillEstimate && parseFloat(fillEstimate.slippagePercent ?? '0') > 1 && (
          <div className="bg-nvx-warning/10 border border-nvx-warning/30 rounded px-3 py-2 text-xs text-nvx-warning">
            High slippage: ~{fillEstimate.slippagePercent}% from last price.
            Consider using a limit order.
          </div>
        )}

        {/* Submission state feedback */}
        {submitState === 'confirmed' && (
          <div className="bg-nvx-buy/10 border border-nvx-buy/30 rounded px-3 py-2 text-xs text-nvx-buy flex items-center justify-between">
            <span>Order submitted successfully</span>
            <button onClick={onResetState} className="underline ml-2">dismiss</button>
          </div>
        )}
        {submitState === 'failed' && submitError && (
          <div className="bg-nvx-sell/10 border border-nvx-sell/30 rounded px-3 py-2 text-xs text-nvx-sell flex items-center justify-between">
            <span>{submitError}</span>
            <button onClick={onResetState} className="underline ml-2">retry</button>
          </div>
        )}

        {/* Submit */}
        <Button
          variant={side === 'buy' ? 'success' : 'danger'}
          fullWidth
          size="lg"
          onClick={handleSubmit}
          isLoading={loading || submitState === 'pending'}
          disabled={!canSubmit || submitState === 'pending'}
        >
          {submitState === 'pending'
            ? 'Submitting...'
            : isOCO
              ? `OCO ${side === 'buy' ? 'Buy' : 'Sell'} ${baseAsset}`
              : isTrailing
                ? `Trail ${side === 'buy' ? 'Buy' : 'Sell'} ${baseAsset}`
                : `${isMarket ? 'Market ' : ''}${side === 'buy' ? 'Buy' : 'Sell'} ${baseAsset}`
          }
        </Button>
      </div>
    </div>
  );
}
