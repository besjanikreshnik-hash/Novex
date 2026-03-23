'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  X,
  Loader2,
  AlertTriangle,
  ChevronDown,
  Shield,
  Target,
} from 'lucide-react';
import {
  futuresApi,
  type FuturesContractDto,
  type FuturesPositionDto,
} from '@/lib/api';
import { cn } from '@/lib/utils';

export default function FuturesPage() {
  /* ── State ──────────────────────────────────────────── */
  const [contracts, setContracts] = useState<FuturesContractDto[]>([]);
  const [positions, setPositions] = useState<FuturesPositionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected contract
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [contractDropdownOpen, setContractDropdownOpen] = useState(false);

  // Order form
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [leverage, setLeverage] = useState(10);
  const [margin, setMargin] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState('');

  // Close position loading
  const [closeLoading, setCloseLoading] = useState<string | null>(null);

  // SL/TP modal
  const [slTpModal, setSlTpModal] = useState<FuturesPositionDto | null>(null);
  const [slValue, setSlValue] = useState('');
  const [tpValue, setTpValue] = useState('');
  const [slTpLoading, setSlTpLoading] = useState(false);

  /* ── Data loading ───────────────────────────────────── */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        futuresApi.getContracts(),
        futuresApi.getPositions().catch(() => [] as FuturesPositionDto[]),
      ]);
      setContracts(c);
      setPositions(p);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load futures data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh positions every 10s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const p = await futuresApi.getPositions();
        setPositions(p);
      } catch { /* ignore */ }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const selectedContract = useMemo(
    () => contracts.find((c) => c.symbol === selectedSymbol),
    [contracts, selectedSymbol],
  );

  const maxLeverage = selectedContract?.maxLeverage ?? 20;

  const openPositions = useMemo(
    () => positions.filter((p) => p.status === 'open'),
    [positions],
  );

  const closedPositions = useMemo(
    () => positions.filter((p) => p.status !== 'open').slice(0, 10),
    [positions],
  );

  /* ── Handlers ───────────────────────────────────────── */
  const handleOpenPosition = async () => {
    if (!margin || !selectedContract) return;
    setOrderLoading(true);
    setOrderError('');
    try {
      await futuresApi.openPosition({
        symbol: selectedSymbol,
        side,
        leverage,
        margin,
        entryPrice: selectedContract.markPrice,
      });
      setMargin('');
      await loadData();
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Failed to open position');
    } finally {
      setOrderLoading(false);
    }
  };

  const handleClosePosition = async (positionId: string) => {
    setCloseLoading(positionId);
    try {
      await futuresApi.closePosition(positionId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close position');
    } finally {
      setCloseLoading(null);
    }
  };

  const handleSetSlTp = async () => {
    if (!slTpModal) return;
    setSlTpLoading(true);
    try {
      await futuresApi.setSlTp(
        slTpModal.id,
        slValue || null,
        tpValue || null,
      );
      setSlTpModal(null);
      setSlValue('');
      setTpValue('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set SL/TP');
    } finally {
      setSlTpLoading(false);
    }
  };

  /* ── Computed values for position panel ─────────────── */
  const positionNotional = useMemo(() => {
    if (!margin || !selectedContract) return '0.00';
    const m = parseFloat(margin) || 0;
    return (m * leverage).toFixed(2);
  }, [margin, leverage, selectedContract]);

  const estimatedLiquidation = useMemo(() => {
    if (!margin || !selectedContract) return '--';
    const entry = parseFloat(selectedContract.markPrice);
    if (side === 'long') {
      return (entry * (1 - 1 / leverage + 0.005)).toFixed(2);
    } else {
      return (entry * (1 + 1 / leverage - 0.005)).toFixed(2);
    }
  }, [margin, leverage, side, selectedContract]);

  /* ── Render ─────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-nvx-accent" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-nvx-text-primary">Futures Trading</h1>
        {selectedContract && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-nvx-text-secondary">
              Funding Rate:{' '}
              <span className="text-nvx-text-primary">
                {(parseFloat(selectedContract.fundingRate) * 100).toFixed(4)}%
              </span>
            </span>
            <span className="text-nvx-text-secondary">
              Mark Price:{' '}
              <span className="text-nvx-text-primary font-mono">
                ${parseFloat(selectedContract.markPrice).toLocaleString()}
              </span>
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-nvx-danger/10 border border-nvx-danger/30 rounded-xl p-3 flex items-center gap-2 text-nvx-danger text-sm">
          <AlertTriangle size={16} />
          {error}
          <button onClick={() => setError('')} className="ml-auto">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Order Form ────────────────────────── */}
        <div className="lg:col-span-1 space-y-4">
          {/* Contract Selector */}
          <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-4 space-y-4">
            <div className="relative">
              <button
                onClick={() => setContractDropdownOpen(!contractDropdownOpen)}
                className="w-full flex items-center justify-between bg-nvx-bg-tertiary border border-nvx-border rounded-lg px-3 py-2.5 text-sm font-medium text-nvx-text-primary hover:bg-nvx-bg-tertiary/80 transition-colors"
              >
                <span>{selectedSymbol} Perpetual</span>
                <ChevronDown size={16} className="text-nvx-text-secondary" />
              </button>
              {contractDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-nvx-bg-tertiary border border-nvx-border rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                  {contracts.map((c) => (
                    <button
                      key={c.symbol}
                      onClick={() => {
                        setSelectedSymbol(c.symbol);
                        setContractDropdownOpen(false);
                        if (leverage > c.maxLeverage) setLeverage(c.maxLeverage);
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm hover:bg-nvx-bg-secondary transition-colors',
                        c.symbol === selectedSymbol
                          ? 'text-nvx-accent bg-nvx-accent/10'
                          : 'text-nvx-text-primary',
                      )}
                    >
                      <div className="flex justify-between">
                        <span>{c.symbol} Perpetual</span>
                        <span className="text-nvx-text-secondary">{c.maxLeverage}x</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Long / Short buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSide('long')}
                className={cn(
                  'py-2.5 rounded-lg font-semibold text-sm transition-colors',
                  side === 'long'
                    ? 'bg-nvx-success text-white'
                    : 'bg-nvx-bg-tertiary text-nvx-text-secondary hover:text-nvx-text-primary',
                )}
              >
                <TrendingUp size={16} className="inline mr-1" />
                Long
              </button>
              <button
                onClick={() => setSide('short')}
                className={cn(
                  'py-2.5 rounded-lg font-semibold text-sm transition-colors',
                  side === 'short'
                    ? 'bg-nvx-danger text-white'
                    : 'bg-nvx-bg-tertiary text-nvx-text-secondary hover:text-nvx-text-primary',
                )}
              >
                <TrendingDown size={16} className="inline mr-1" />
                Short
              </button>
            </div>

            {/* Leverage slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-nvx-text-secondary">Leverage</span>
                <span className="text-sm font-bold text-nvx-text-primary">{leverage}x</span>
              </div>
              <input
                type="range"
                min={1}
                max={maxLeverage}
                value={leverage}
                onChange={(e) => setLeverage(Number(e.target.value))}
                className="w-full accent-nvx-accent"
              />
              <div className="flex justify-between text-xs text-nvx-text-tertiary mt-1">
                <span>1x</span>
                <span>{Math.floor(maxLeverage / 4)}x</span>
                <span>{Math.floor(maxLeverage / 2)}x</span>
                <span>{Math.floor((maxLeverage * 3) / 4)}x</span>
                <span>{maxLeverage}x</span>
              </div>
            </div>

            {/* Margin input */}
            <div>
              <label className="text-sm text-nvx-text-secondary mb-1 block">
                Margin (USDT)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={margin}
                onChange={(e) => setMargin(e.target.value)}
                placeholder="Enter margin amount"
                className="w-full bg-nvx-bg-tertiary border border-nvx-border rounded-lg px-3 py-2.5 text-sm text-nvx-text-primary placeholder:text-nvx-text-tertiary focus:outline-none focus:border-nvx-accent transition-colors"
              />
            </div>

            {/* Position preview panel */}
            {margin && selectedContract && (
              <div className="bg-nvx-bg-tertiary rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-nvx-text-secondary">Entry Price</span>
                  <span className="text-nvx-text-primary font-mono">
                    ${parseFloat(selectedContract.markPrice).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-nvx-text-secondary">Position Size</span>
                  <span className="text-nvx-text-primary font-mono">
                    ${parseFloat(positionNotional).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-nvx-text-secondary">Liq. Price</span>
                  <span className="text-nvx-danger font-mono">${estimatedLiquidation}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-nvx-text-secondary">Margin Ratio</span>
                  <span className="text-nvx-text-primary font-mono">
                    {leverage > 0 ? (100 / leverage).toFixed(2) : '0'}%
                  </span>
                </div>
              </div>
            )}

            {orderError && (
              <p className="text-nvx-danger text-xs">{orderError}</p>
            )}

            <button
              onClick={handleOpenPosition}
              disabled={orderLoading || !margin || parseFloat(margin) <= 0}
              className={cn(
                'w-full py-3 rounded-lg font-semibold text-sm text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                side === 'long'
                  ? 'bg-nvx-success hover:bg-nvx-success/90'
                  : 'bg-nvx-danger hover:bg-nvx-danger/90',
              )}
            >
              {orderLoading ? (
                <Loader2 size={16} className="animate-spin inline mr-1" />
              ) : null}
              {side === 'long' ? 'Open Long' : 'Open Short'} {selectedSymbol}
            </button>
          </div>
        </div>

        {/* ── Right: Positions ────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Open Positions */}
          <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-nvx-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-nvx-text-primary">
                Open Positions ({openPositions.length})
              </h2>
            </div>

            {openPositions.length === 0 ? (
              <div className="p-8 text-center text-nvx-text-tertiary text-sm">
                No open positions. Open a long or short position to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-nvx-text-tertiary text-xs border-b border-nvx-border">
                      <th className="text-left px-4 py-2 font-medium">Symbol</th>
                      <th className="text-left px-4 py-2 font-medium">Side</th>
                      <th className="text-right px-4 py-2 font-medium">Size</th>
                      <th className="text-right px-4 py-2 font-medium">Entry</th>
                      <th className="text-right px-4 py-2 font-medium">Mark</th>
                      <th className="text-right px-4 py-2 font-medium">Liq. Price</th>
                      <th className="text-right px-4 py-2 font-medium">Margin</th>
                      <th className="text-right px-4 py-2 font-medium">PnL</th>
                      <th className="text-right px-4 py-2 font-medium">SL / TP</th>
                      <th className="text-right px-4 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openPositions.map((pos) => {
                      const pnl = parseFloat(pos.unrealizedPnl);
                      const pnlPct = parseFloat(pos.margin) > 0
                        ? (pnl / parseFloat(pos.margin)) * 100
                        : 0;
                      return (
                        <tr
                          key={pos.id}
                          className="border-b border-nvx-border/50 hover:bg-nvx-bg-tertiary/30 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium text-nvx-text-primary">
                            {pos.symbol}
                            <span className="text-nvx-text-tertiary text-xs ml-1">
                              {pos.leverage}x
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded text-xs font-semibold',
                                pos.side === 'long'
                                  ? 'bg-nvx-success/15 text-nvx-success'
                                  : 'bg-nvx-danger/15 text-nvx-danger',
                              )}
                            >
                              {pos.side.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-nvx-text-primary">
                            {parseFloat(pos.quantity).toFixed(6)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-nvx-text-primary">
                            ${parseFloat(pos.entryPrice).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-nvx-text-primary">
                            ${parseFloat(pos.markPrice).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-nvx-danger">
                            ${parseFloat(pos.liquidationPrice).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-nvx-text-primary">
                            ${parseFloat(pos.margin).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={cn(
                                'font-mono font-semibold',
                                pnl >= 0 ? 'text-nvx-success' : 'text-nvx-danger',
                              )}
                            >
                              {pnl >= 0 ? '+' : ''}
                              {pnl.toFixed(2)}
                              <span className="text-xs ml-1">
                                ({pnlPct >= 0 ? '+' : ''}
                                {pnlPct.toFixed(2)}%)
                              </span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-nvx-text-secondary">
                            <button
                              onClick={() => {
                                setSlTpModal(pos);
                                setSlValue(pos.stopLoss ?? '');
                                setTpValue(pos.takeProfit ?? '');
                              }}
                              className="hover:text-nvx-accent transition-colors"
                              title="Set SL/TP"
                            >
                              <div className="flex items-center gap-1 justify-end">
                                <Shield size={12} />
                                {pos.stopLoss
                                  ? `$${parseFloat(pos.stopLoss).toLocaleString()}`
                                  : '--'}
                                <span className="text-nvx-text-tertiary">/</span>
                                <Target size={12} />
                                {pos.takeProfit
                                  ? `$${parseFloat(pos.takeProfit).toLocaleString()}`
                                  : '--'}
                              </div>
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleClosePosition(pos.id)}
                              disabled={closeLoading === pos.id}
                              className="px-3 py-1 bg-nvx-danger/15 text-nvx-danger rounded-lg text-xs font-medium hover:bg-nvx-danger/25 transition-colors disabled:opacity-50"
                            >
                              {closeLoading === pos.id ? (
                                <Loader2 size={12} className="animate-spin inline" />
                              ) : (
                                'Close'
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Closed Positions History */}
          {closedPositions.length > 0 && (
            <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-nvx-border">
                <h2 className="text-sm font-semibold text-nvx-text-primary">
                  Recent Closed Positions
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-nvx-text-tertiary text-xs border-b border-nvx-border">
                      <th className="text-left px-4 py-2 font-medium">Symbol</th>
                      <th className="text-left px-4 py-2 font-medium">Side</th>
                      <th className="text-right px-4 py-2 font-medium">Entry</th>
                      <th className="text-right px-4 py-2 font-medium">Close</th>
                      <th className="text-right px-4 py-2 font-medium">Realized PnL</th>
                      <th className="text-right px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closedPositions.map((pos) => {
                      const pnl = parseFloat(pos.realizedPnl);
                      return (
                        <tr
                          key={pos.id}
                          className="border-b border-nvx-border/50"
                        >
                          <td className="px-4 py-3 font-medium text-nvx-text-primary">
                            {pos.symbol}
                            <span className="text-nvx-text-tertiary text-xs ml-1">
                              {pos.leverage}x
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded text-xs font-semibold',
                                pos.side === 'long'
                                  ? 'bg-nvx-success/15 text-nvx-success'
                                  : 'bg-nvx-danger/15 text-nvx-danger',
                              )}
                            >
                              {pos.side.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-nvx-text-primary">
                            ${parseFloat(pos.entryPrice).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-nvx-text-primary">
                            ${parseFloat(pos.markPrice).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={cn(
                                'font-mono font-semibold',
                                pnl >= 0 ? 'text-nvx-success' : 'text-nvx-danger',
                              )}
                            >
                              {pnl >= 0 ? '+' : ''}
                              {pnl.toFixed(2)} USDT
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded text-xs',
                                pos.status === 'liquidated'
                                  ? 'bg-nvx-danger/15 text-nvx-danger'
                                  : 'bg-nvx-bg-tertiary text-nvx-text-secondary',
                              )}
                            >
                              {pos.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SL/TP Modal */}
      {slTpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-nvx-text-primary">
                Set SL/TP — {slTpModal.symbol}
              </h3>
              <button
                onClick={() => setSlTpModal(null)}
                className="text-nvx-text-tertiary hover:text-nvx-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-sm text-nvx-text-secondary">
              {slTpModal.side.toUpperCase()} @ ${parseFloat(slTpModal.entryPrice).toLocaleString()} ({slTpModal.leverage}x)
            </div>

            <div>
              <label className="text-sm text-nvx-text-secondary mb-1 block">
                Stop Loss Price (USDT)
              </label>
              <input
                type="number"
                step="0.01"
                value={slValue}
                onChange={(e) => setSlValue(e.target.value)}
                placeholder="Leave empty to remove"
                className="w-full bg-nvx-bg-tertiary border border-nvx-border rounded-lg px-3 py-2 text-sm text-nvx-text-primary placeholder:text-nvx-text-tertiary focus:outline-none focus:border-nvx-danger transition-colors"
              />
            </div>

            <div>
              <label className="text-sm text-nvx-text-secondary mb-1 block">
                Take Profit Price (USDT)
              </label>
              <input
                type="number"
                step="0.01"
                value={tpValue}
                onChange={(e) => setTpValue(e.target.value)}
                placeholder="Leave empty to remove"
                className="w-full bg-nvx-bg-tertiary border border-nvx-border rounded-lg px-3 py-2 text-sm text-nvx-text-primary placeholder:text-nvx-text-tertiary focus:outline-none focus:border-nvx-success transition-colors"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setSlTpModal(null)}
                className="flex-1 py-2 bg-nvx-bg-tertiary text-nvx-text-secondary rounded-lg text-sm hover:bg-nvx-bg-tertiary/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSetSlTp}
                disabled={slTpLoading}
                className="flex-1 py-2 bg-nvx-accent text-white rounded-lg text-sm font-medium hover:bg-nvx-accent/90 transition-colors disabled:opacity-50"
              >
                {slTpLoading ? (
                  <Loader2 size={14} className="animate-spin inline mr-1" />
                ) : null}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
