'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowDownUp,
  ChevronDown,
  Check,
  AlertCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import {
  marketApi,
  walletApi,
  tradingApi,
  type TradingPairDto,
  type TickerDto,
  type BalanceDto,
} from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { generateIdempotencyKey } from '@/lib/idempotency';

/* ─── Available assets for conversion (USDT pairs) ──── */

interface AssetOption {
  symbol: string;
  name: string;
}

const ASSETS: AssetOption[] = [
  { symbol: 'USDT', name: 'Tether' },
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'XRP', name: 'Ripple' },
  { symbol: 'ADA', name: 'Cardano' },
  { symbol: 'DOGE', name: 'Dogecoin' },
  { symbol: 'DOT', name: 'Polkadot' },
];

/* ─── Asset Selector Dropdown ───────────────────────── */

function AssetSelector({
  selected,
  onSelect,
  exclude,
  label,
}: {
  selected: string;
  onSelect: (symbol: string) => void;
  exclude: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const asset = ASSETS.find((a) => a.symbol === selected);

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-nvx-text-muted mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2.5 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm font-medium text-nvx-text-primary hover:border-nvx-primary/50 transition-colors w-full"
      >
        <span className="w-6 h-6 rounded-full bg-nvx-primary/20 flex items-center justify-center text-[10px] font-bold text-nvx-primary flex-shrink-0">
          {selected.slice(0, 2)}
        </span>
        <span className="flex-1 text-left">
          {asset?.symbol ?? selected}
          <span className="text-nvx-text-muted ml-1.5 text-xs font-normal">{asset?.name}</span>
        </span>
        <ChevronDown size={14} className={cn('text-nvx-text-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-nvx-bg-secondary border border-nvx-border rounded-lg shadow-xl overflow-hidden">
          {ASSETS.filter((a) => a.symbol !== exclude).map((a) => (
            <button
              key={a.symbol}
              onClick={() => {
                onSelect(a.symbol);
                setOpen(false);
              }}
              className={cn(
                'flex items-center gap-2 w-full px-3 py-2.5 text-sm hover:bg-nvx-bg-tertiary transition-colors text-left',
                a.symbol === selected ? 'bg-nvx-primary/10 text-nvx-primary' : 'text-nvx-text-primary',
              )}
            >
              <span className="w-6 h-6 rounded-full bg-nvx-primary/20 flex items-center justify-center text-[10px] font-bold text-nvx-primary flex-shrink-0">
                {a.symbol.slice(0, 2)}
              </span>
              <span>{a.symbol}</span>
              <span className="text-nvx-text-muted text-xs">{a.name}</span>
              {a.symbol === selected && <Check size={14} className="ml-auto text-nvx-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main Convert Page ─────────────────────────────── */

type ConvertStep = 'form' | 'preview' | 'converting' | 'success' | 'error';

export default function ConvertPage() {
  // Assets
  const [fromAsset, setFromAsset] = useState('USDT');
  const [toAsset, setToAsset] = useState('BTC');
  const [fromAmount, setFromAmount] = useState('');

  // Market data
  const [pairs, setPairs] = useState<TradingPairDto[]>([]);
  const [ticker, setTicker] = useState<TickerDto | null>(null);
  const [balances, setBalances] = useState<BalanceDto[]>([]);
  const [loadingPrice, setLoadingPrice] = useState(false);

  // Conversion state
  const [step, setStep] = useState<ConvertStep>('form');
  const [showModal, setShowModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Derived: build the pair symbol for whichever side is USDT
  const pairSymbol = fromAsset === 'USDT'
    ? `${toAsset}USDT`
    : `${fromAsset}USDT`;

  // Derived: get price from ticker
  const price = ticker ? parseFloat(ticker.lastPrice) : 0;

  // Derived: calculate estimated output
  const fromNum = parseFloat(fromAmount) || 0;
  const fee = fromNum * 0.001; // 0.1% fee
  const netFrom = fromNum - fee;

  let toAmount = 0;
  if (price > 0 && netFrom > 0) {
    if (fromAsset === 'USDT') {
      // Buying crypto with USDT
      toAmount = netFrom / price;
    } else {
      // Selling crypto for USDT
      toAmount = netFrom * price;
    }
  }

  // Derived: exchange rate display
  const rateDisplay =
    price > 0
      ? fromAsset === 'USDT'
        ? `1 ${toAsset} = ${price.toLocaleString(undefined, { maximumFractionDigits: 8 })} USDT`
        : `1 ${fromAsset} = ${price.toLocaleString(undefined, { maximumFractionDigits: 8 })} USDT`
      : '--';

  // Derived: available balance
  const fromBalance = balances.find((b) => b.currency === fromAsset);
  const availableBalance = fromBalance ? parseFloat(fromBalance.available) : 0;

  // Fetch pairs + balances on mount
  useEffect(() => {
    marketApi.getPairs().then(setPairs).catch(() => {});
    walletApi.getBalances().then(setBalances).catch(() => {});
  }, []);

  // Fetch ticker when pair changes
  const fetchTicker = useCallback(async () => {
    if (!pairSymbol) return;
    setLoadingPrice(true);
    try {
      const t = await marketApi.getTicker(pairSymbol);
      setTicker(t);
    } catch {
      setTicker(null);
    } finally {
      setLoadingPrice(false);
    }
  }, [pairSymbol]);

  useEffect(() => {
    fetchTicker();
    const interval = setInterval(fetchTicker, 10000);
    return () => clearInterval(interval);
  }, [fetchTicker]);

  // Swap from/to
  const handleSwap = () => {
    const prevFrom = fromAsset;
    const prevTo = toAsset;
    setFromAsset(prevTo);
    setToAsset(prevFrom);
    setFromAmount('');
  };

  // Set max
  const handleMax = () => {
    if (availableBalance > 0) {
      setFromAmount(availableBalance.toString());
    }
  };

  // Preview
  const handlePreview = () => {
    setErrorMsg('');
    if (fromNum <= 0) {
      setErrorMsg('Enter an amount to convert');
      return;
    }
    if (fromNum > availableBalance) {
      setErrorMsg('Insufficient balance');
      return;
    }
    if (price <= 0) {
      setErrorMsg('Price unavailable. Try again.');
      return;
    }
    setStep('preview');
    setShowModal(true);
  };

  // Execute conversion (market order)
  const handleConvert = async () => {
    setStep('converting');
    try {
      const idempotencyKey = generateIdempotencyKey();

      if (fromAsset === 'USDT') {
        // Buy: place market buy order on {toAsset}USDT
        await tradingApi.placeOrder(
          {
            symbol: `${toAsset}USDT`,
            side: 'buy',
            type: 'market',
            price: '0',
            quantity: toAmount.toFixed(8),
          },
          idempotencyKey,
        );
      } else {
        // Sell: place market sell order on {fromAsset}USDT
        await tradingApi.placeOrder(
          {
            symbol: `${fromAsset}USDT`,
            side: 'sell',
            type: 'market',
            price: '0',
            quantity: fromNum.toFixed(8),
          },
          idempotencyKey,
        );
      }

      setStep('success');
      // Refresh balances
      walletApi.getBalances().then(setBalances).catch(() => {});
    } catch (err) {
      setStep('error');
      setErrorMsg(err instanceof Error ? err.message : 'Conversion failed');
    }
  };

  // Close modal and reset
  const closeModal = () => {
    setShowModal(false);
    if (step === 'success') {
      setFromAmount('');
    }
    setStep('form');
    setErrorMsg('');
  };

  // Validation
  const isValid = fromNum > 0 && fromNum <= availableBalance && price > 0;

  // Fee display
  const feeFromAsset = fromAsset;
  const feeDisplay = fee > 0 ? `${fee.toFixed(fromAsset === 'USDT' ? 2 : 8)} ${feeFromAsset}` : '--';

  return (
    <div className="bg-nvx-bg-primary min-h-[calc(100vh-56px)] flex items-start justify-center p-4 sm:p-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-nvx-text-primary">Convert</h1>
          <p className="text-sm text-nvx-text-muted mt-1">
            Instantly swap between assets at market price
          </p>
        </div>

        {/* Card */}
        <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl overflow-hidden">
          <div className="p-5 space-y-4">
            {/* ── FROM ── */}
            <div className="bg-nvx-bg-primary border border-nvx-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-nvx-text-muted uppercase tracking-wider">From</span>
                <button
                  onClick={handleMax}
                  className="text-xs text-nvx-primary hover:text-nvx-primary/80 transition-colors font-medium"
                >
                  Available: {availableBalance.toLocaleString(undefined, { maximumFractionDigits: 8 })} {fromAsset}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <input
                    type="number"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="any"
                    className="w-full bg-transparent text-2xl font-semibold text-nvx-text-primary placeholder-nvx-text-muted/40 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                <div className="w-36 flex-shrink-0">
                  <AssetSelector
                    selected={fromAsset}
                    onSelect={setFromAsset}
                    exclude={toAsset}
                    label=""
                  />
                </div>
              </div>
            </div>

            {/* ── SWAP BUTTON ── */}
            <div className="flex justify-center -my-1">
              <button
                onClick={handleSwap}
                className="w-10 h-10 rounded-full bg-nvx-bg-tertiary border border-nvx-border flex items-center justify-center hover:bg-nvx-primary/10 hover:border-nvx-primary/50 transition-colors group"
              >
                <ArrowDownUp size={18} className="text-nvx-text-muted group-hover:text-nvx-primary transition-colors" />
              </button>
            </div>

            {/* ── TO ── */}
            <div className="bg-nvx-bg-primary border border-nvx-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-nvx-text-muted uppercase tracking-wider">To</span>
                {loadingPrice && (
                  <Loader2 size={12} className="text-nvx-text-muted animate-spin" />
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-2xl font-semibold text-nvx-text-primary">
                    {toAmount > 0
                      ? toAmount.toLocaleString(undefined, {
                          maximumFractionDigits: toAsset === 'USDT' ? 2 : 8,
                        })
                      : <span className="text-nvx-text-muted/40">0.00</span>}
                  </div>
                </div>
                <div className="w-36 flex-shrink-0">
                  <AssetSelector
                    selected={toAsset}
                    onSelect={setToAsset}
                    exclude={fromAsset}
                    label=""
                  />
                </div>
              </div>
            </div>

            {/* ── Exchange Rate ── */}
            {price > 0 && (
              <div className="flex items-center justify-center gap-2 py-1">
                <ArrowRight size={12} className="text-nvx-text-muted" />
                <span className="text-xs text-nvx-text-secondary font-medium">{rateDisplay}</span>
              </div>
            )}

            {/* ── Error Message ── */}
            {errorMsg && step === 'form' && (
              <div className="flex items-center gap-2 text-xs text-nvx-sell bg-nvx-sell/10 border border-nvx-sell/20 rounded-lg px-3 py-2">
                <AlertCircle size={14} />
                {errorMsg}
              </div>
            )}

            {/* ── Preview Button ── */}
            <button
              onClick={handlePreview}
              disabled={!isValid}
              className="w-full py-3 bg-nvx-primary hover:bg-nvx-primary/80 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Preview Conversion
            </button>
          </div>

          {/* ── Info Footer ── */}
          <div className="border-t border-nvx-border px-5 py-3">
            <div className="flex items-center justify-between text-xs text-nvx-text-muted">
              <span>Fee</span>
              <span>0.1%</span>
            </div>
            <div className="flex items-center justify-between text-xs text-nvx-text-muted mt-1">
              <span>Settlement</span>
              <span>Instant</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ Confirmation Modal ═══════ */}
      <Modal isOpen={showModal} onClose={closeModal} title="Confirm Conversion" size="sm">
        <div className="py-2">
          {/* ── Preview state ── */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="bg-nvx-bg-primary border border-nvx-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-nvx-text-muted">From</span>
                  <span className="text-sm font-medium text-nvx-text-primary">
                    {fromNum.toLocaleString(undefined, { maximumFractionDigits: 8 })} {fromAsset}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-nvx-text-muted">To</span>
                  <span className="text-sm font-medium text-nvx-text-primary">
                    {toAmount.toLocaleString(undefined, { maximumFractionDigits: toAsset === 'USDT' ? 2 : 8 })} {toAsset}
                  </span>
                </div>
                <div className="border-t border-nvx-border my-1" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-nvx-text-muted">Rate</span>
                  <span className="text-xs text-nvx-text-secondary">{rateDisplay}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-nvx-text-muted">Fee (0.1%)</span>
                  <span className="text-xs text-nvx-text-secondary">{feeDisplay}</span>
                </div>
                <div className="border-t border-nvx-border my-1" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-nvx-text-secondary">You receive</span>
                  <span className="text-sm font-bold text-nvx-buy">
                    {toAmount.toLocaleString(undefined, { maximumFractionDigits: toAsset === 'USDT' ? 2 : 8 })} {toAsset}
                  </span>
                </div>
              </div>

              <p className="text-xs text-nvx-text-muted text-center">
                Price may change slightly at execution time
              </p>

              <div className="flex gap-3">
                <button
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 bg-nvx-bg-tertiary text-nvx-text-secondary text-sm font-medium rounded-lg hover:bg-nvx-bg-tertiary/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConvert}
                  className="flex-1 px-4 py-2.5 bg-nvx-primary hover:bg-nvx-primary/80 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Convert
                </button>
              </div>
            </div>
          )}

          {/* ── Converting state ── */}
          {step === 'converting' && (
            <div className="text-center py-8">
              <Loader2 size={32} className="text-nvx-primary animate-spin mx-auto mb-3" />
              <p className="text-sm text-nvx-text-secondary">Processing your conversion...</p>
            </div>
          )}

          {/* ── Success state ── */}
          {step === 'success' && (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 rounded-full bg-nvx-buy/10 flex items-center justify-center mx-auto">
                <Check size={28} className="text-nvx-buy" />
              </div>
              <div>
                <p className="text-sm font-semibold text-nvx-text-primary mb-1">Conversion Complete</p>
                <p className="text-xs text-nvx-text-muted">
                  Converted {fromNum.toLocaleString(undefined, { maximumFractionDigits: 8 })} {fromAsset} to{' '}
                  {toAmount.toLocaleString(undefined, { maximumFractionDigits: toAsset === 'USDT' ? 2 : 8 })} {toAsset}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="w-full px-4 py-2.5 bg-nvx-primary hover:bg-nvx-primary/80 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {/* ── Error state ── */}
          {step === 'error' && (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 rounded-full bg-nvx-sell/10 flex items-center justify-center mx-auto">
                <AlertCircle size={28} className="text-nvx-sell" />
              </div>
              <div>
                <p className="text-sm font-semibold text-nvx-text-primary mb-1">Conversion Failed</p>
                <p className="text-xs text-nvx-sell">{errorMsg}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 bg-nvx-bg-tertiary text-nvx-text-secondary text-sm font-medium rounded-lg hover:bg-nvx-bg-tertiary/80 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setStep('preview');
                    setErrorMsg('');
                  }}
                  className="flex-1 px-4 py-2.5 bg-nvx-primary hover:bg-nvx-primary/80 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
