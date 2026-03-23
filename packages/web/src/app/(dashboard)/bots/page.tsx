'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Bot,
  Plus,
  Square,
  Pause,
  Play,
  RefreshCw,
  X,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { botsApi, marketApi, TradingPairDto } from '@/lib/api';

/* ─── Types ────────────────────────────────────────── */

interface GridOrder {
  level: number;
  price: string;
  side: 'buy' | 'sell';
  orderId: string | null;
  status: string;
}

interface GridBotDto {
  id: string;
  userId: string;
  symbol: string;
  status: string;
  gridType: string;
  lowerPrice: string;
  upperPrice: string;
  gridCount: number;
  totalInvestment: string;
  profitPerGrid: string;
  totalProfit: string;
  gridOrders: GridOrder[];
  createdAt: string;
}

/* ─── Grid Visualization ──────────────────────────── */

function GridVisualization({
  lowerPrice,
  upperPrice,
  gridCount,
  gridType,
}: {
  lowerPrice: string;
  upperPrice: string;
  gridCount: number;
  gridType: 'arithmetic' | 'geometric';
}) {
  const lo = parseFloat(lowerPrice);
  const hi = parseFloat(upperPrice);

  if (!lo || !hi || lo >= hi || gridCount < 2) return null;

  const levels: number[] = [];
  const count = Math.min(gridCount, 30); // Cap visual levels

  if (gridType === 'arithmetic') {
    const step = (hi - lo) / count;
    for (let i = 0; i <= count; i++) {
      levels.push(lo + step * i);
    }
  } else {
    const ratio = Math.pow(hi / lo, 1 / count);
    for (let i = 0; i <= count; i++) {
      levels.push(lo * Math.pow(ratio, i));
    }
  }

  const chartHeight = 200;

  return (
    <div className="bg-nvx-bg-tertiary rounded-lg p-4">
      <p className="text-xs text-nvx-text-muted mb-3 font-medium">Grid Preview ({levels.length} levels)</p>
      <div className="relative" style={{ height: chartHeight }}>
        {levels.map((price, i) => {
          const yPercent = ((price - lo) / (hi - lo)) * 100;
          const y = chartHeight - (yPercent / 100) * chartHeight;
          const isMid = i === Math.floor(levels.length / 2);
          return (
            <div
              key={i}
              className="absolute left-0 right-0 flex items-center gap-2"
              style={{ top: y }}
            >
              <div
                className={cn(
                  'flex-1 h-px',
                  isMid ? 'bg-nvx-primary' : 'bg-nvx-border',
                )}
              />
              <span className={cn(
                'text-2xs font-mono shrink-0',
                isMid ? 'text-nvx-primary' : 'text-nvx-text-muted',
              )}>
                ${price.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────── */

export default function BotsPage() {
  const { isAuthenticated } = useAuthStore();
  const [bots, setBots] = useState<GridBotDto[]>([]);
  const [pairs, setPairs] = useState<TradingPairDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [symbol, setSymbol] = useState('BTC/USDT');
  const [gridType, setGridType] = useState<'arithmetic' | 'geometric'>('arithmetic');
  const [lowerPrice, setLowerPrice] = useState('');
  const [upperPrice, setUpperPrice] = useState('');
  const [gridCount, setGridCount] = useState(10);
  const [investment, setInvestment] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const pairsData = await marketApi.getPairs();
      setPairs(pairsData);
      if (isAuthenticated) {
        const botsData = await botsApi.getBots();
        setBots(botsData);
      }
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!lowerPrice || !upperPrice || !investment) return;
    setCreating(true);
    try {
      await botsApi.createGridBot({
        symbol,
        gridType,
        lowerPrice,
        upperPrice,
        gridCount,
        totalInvestment: investment,
      });
      setShowCreate(false);
      setLowerPrice('');
      setUpperPrice('');
      setGridCount(10);
      setInvestment('');
      await fetchData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleStop = async (botId: string) => {
    try {
      await botsApi.stopBot(botId);
      await fetchData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handlePause = async (botId: string) => {
    try {
      await botsApi.pauseBot(botId);
      await fetchData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleResume = async (botId: string) => {
    try {
      await botsApi.resumeBot(botId);
      await fetchData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Bot size={24} className="text-nvx-primary" />
            <h1 className="text-2xl font-bold text-nvx-text-primary">Grid Bots</h1>
          </div>
          <p className="text-sm text-nvx-text-secondary ml-9">
            Automate your trading with grid bot strategies
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-nvx-primary text-white rounded-lg hover:bg-nvx-primary/90 transition-colors"
        >
          <Plus size={16} />
          Create Bot
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={20} className="text-nvx-primary animate-spin" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex items-center justify-center py-8 text-sm text-nvx-sell">
          {error}
        </div>
      )}

      {/* Bots List */}
      {!loading && !error && (
        <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[1fr_120px_120px_100px_100px_80px_140px] gap-4 px-5 py-3 border-b border-nvx-border text-xs font-semibold text-nvx-text-secondary uppercase tracking-wider">
            <div>Pair / Type</div>
            <div className="text-right">Range</div>
            <div className="text-right">Investment</div>
            <div className="text-right">Grids</div>
            <div className="text-right">Profit</div>
            <div className="text-center">Status</div>
            <div className="text-right">Actions</div>
          </div>

          {bots.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-sm text-nvx-text-muted">
              <Bot size={32} className="mb-3 opacity-30" />
              No bots created yet. Create your first grid bot!
            </div>
          )}

          {bots.map((bot) => {
            const profit = parseFloat(bot.totalProfit);
            return (
              <div
                key={bot.id}
                className="grid grid-cols-[1fr_120px_120px_100px_100px_80px_140px] gap-4 px-5 py-3 items-center border-b border-nvx-border/50 last:border-b-0 hover:bg-nvx-bg-tertiary/50 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-nvx-text-primary">{bot.symbol}</p>
                  <p className="text-2xs text-nvx-text-muted capitalize">{bot.gridType}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono text-nvx-text-secondary">
                    ${parseFloat(bot.lowerPrice).toFixed(2)}
                  </p>
                  <p className="text-xs font-mono text-nvx-text-secondary">
                    ${parseFloat(bot.upperPrice).toFixed(2)}
                  </p>
                </div>
                <div className="text-sm font-mono text-right text-nvx-text-secondary">
                  ${parseFloat(bot.totalInvestment).toFixed(2)}
                </div>
                <div className="text-sm font-mono text-right text-nvx-text-secondary">
                  {bot.gridCount}
                </div>
                <div className={cn(
                  'text-sm font-mono text-right font-semibold',
                  profit >= 0 ? 'text-nvx-buy' : 'text-nvx-sell',
                )}>
                  ${profit.toFixed(2)}
                </div>
                <div className="text-center">
                  <span className={cn(
                    'inline-block px-2 py-0.5 text-2xs font-semibold rounded',
                    bot.status === 'running' && 'bg-nvx-buy/20 text-nvx-buy',
                    bot.status === 'paused' && 'bg-yellow-500/20 text-yellow-400',
                    bot.status === 'stopped' && 'bg-nvx-sell/20 text-nvx-sell',
                  )}>
                    {bot.status}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-1">
                  {bot.status === 'running' && (
                    <button
                      onClick={() => handlePause(bot.id)}
                      className="p-1.5 text-nvx-text-secondary hover:text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-colors"
                      title="Pause"
                    >
                      <Pause size={14} />
                    </button>
                  )}
                  {bot.status === 'paused' && (
                    <button
                      onClick={() => handleResume(bot.id)}
                      className="p-1.5 text-nvx-text-secondary hover:text-nvx-buy hover:bg-nvx-buy/10 rounded-lg transition-colors"
                      title="Resume"
                    >
                      <Play size={14} />
                    </button>
                  )}
                  {bot.status !== 'stopped' && (
                    <button
                      onClick={() => handleStop(bot.id)}
                      className="p-1.5 text-nvx-text-secondary hover:text-nvx-sell hover:bg-nvx-sell/10 rounded-lg transition-colors"
                      title="Stop"
                    >
                      <Square size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Bot Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-nvx-bg-secondary border border-nvx-border rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-nvx-text-primary">Create Grid Bot</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="p-1 text-nvx-text-secondary hover:text-nvx-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Pair Selector */}
              <div>
                <label className="block text-xs font-medium text-nvx-text-secondary mb-1.5">
                  Trading Pair
                </label>
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="w-full px-3 py-2.5 bg-nvx-bg-tertiary border border-nvx-border rounded-lg text-sm text-nvx-text-primary focus:outline-none focus:ring-1 focus:ring-nvx-primary"
                >
                  {pairs.length > 0
                    ? pairs.map((p) => (
                        <option key={p.id} value={p.symbol}>{p.symbol}</option>
                      ))
                    : (
                      <>
                        <option value="BTC/USDT">BTC/USDT</option>
                        <option value="ETH/USDT">ETH/USDT</option>
                        <option value="SOL/USDT">SOL/USDT</option>
                      </>
                    )
                  }
                </select>
              </div>

              {/* Grid Type */}
              <div>
                <label className="block text-xs font-medium text-nvx-text-secondary mb-1.5">
                  Grid Type
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setGridType('arithmetic')}
                    className={cn(
                      'flex-1 py-2 text-sm font-medium rounded-lg border transition-colors',
                      gridType === 'arithmetic'
                        ? 'bg-nvx-primary text-white border-nvx-primary'
                        : 'bg-nvx-bg-tertiary text-nvx-text-secondary border-nvx-border hover:border-nvx-primary/40',
                    )}
                  >
                    Arithmetic
                  </button>
                  <button
                    onClick={() => setGridType('geometric')}
                    className={cn(
                      'flex-1 py-2 text-sm font-medium rounded-lg border transition-colors',
                      gridType === 'geometric'
                        ? 'bg-nvx-primary text-white border-nvx-primary'
                        : 'bg-nvx-bg-tertiary text-nvx-text-secondary border-nvx-border hover:border-nvx-primary/40',
                    )}
                  >
                    Geometric
                  </button>
                </div>
              </div>

              {/* Price Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-nvx-text-secondary mb-1.5">
                    Lower Price
                  </label>
                  <input
                    type="number"
                    value={lowerPrice}
                    onChange={(e) => setLowerPrice(e.target.value)}
                    placeholder="e.g. 25000"
                    className="w-full px-3 py-2.5 bg-nvx-bg-tertiary border border-nvx-border rounded-lg text-sm text-nvx-text-primary placeholder:text-nvx-text-muted focus:outline-none focus:ring-1 focus:ring-nvx-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-nvx-text-secondary mb-1.5">
                    Upper Price
                  </label>
                  <input
                    type="number"
                    value={upperPrice}
                    onChange={(e) => setUpperPrice(e.target.value)}
                    placeholder="e.g. 35000"
                    className="w-full px-3 py-2.5 bg-nvx-bg-tertiary border border-nvx-border rounded-lg text-sm text-nvx-text-primary placeholder:text-nvx-text-muted focus:outline-none focus:ring-1 focus:ring-nvx-primary"
                  />
                </div>
              </div>

              {/* Grid Count Slider */}
              <div>
                <label className="block text-xs font-medium text-nvx-text-secondary mb-1.5">
                  Grid Count: <span className="text-nvx-primary font-bold">{gridCount}</span>
                </label>
                <input
                  type="range"
                  min={5}
                  max={200}
                  value={gridCount}
                  onChange={(e) => setGridCount(parseInt(e.target.value, 10))}
                  className="w-full accent-[hsl(var(--nvx-primary))]"
                />
                <div className="flex justify-between text-2xs text-nvx-text-muted">
                  <span>5</span>
                  <span>200</span>
                </div>
              </div>

              {/* Investment Amount */}
              <div>
                <label className="block text-xs font-medium text-nvx-text-secondary mb-1.5">
                  Total Investment (USDT)
                </label>
                <input
                  type="number"
                  value={investment}
                  onChange={(e) => setInvestment(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full px-3 py-2.5 bg-nvx-bg-tertiary border border-nvx-border rounded-lg text-sm text-nvx-text-primary placeholder:text-nvx-text-muted focus:outline-none focus:ring-1 focus:ring-nvx-primary"
                />
              </div>

              {/* Grid Visualization */}
              {lowerPrice && upperPrice && (
                <GridVisualization
                  lowerPrice={lowerPrice}
                  upperPrice={upperPrice}
                  gridCount={gridCount}
                  gridType={gridType}
                />
              )}

              {/* Estimated profit per grid */}
              {lowerPrice && upperPrice && gridCount > 0 && (
                <div className="bg-nvx-bg-tertiary rounded-lg p-3 flex items-center gap-3">
                  <TrendingUp size={16} className="text-nvx-buy shrink-0" />
                  <div>
                    <p className="text-xs text-nvx-text-muted">Est. Profit Per Grid</p>
                    <p className="text-sm font-semibold text-nvx-buy">
                      ${((parseFloat(upperPrice) - parseFloat(lowerPrice)) / gridCount).toFixed(4)}
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={handleCreate}
                disabled={creating || !lowerPrice || !upperPrice || !investment}
                className="w-full py-2.5 text-sm font-semibold text-white bg-nvx-primary hover:bg-nvx-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {creating ? 'Creating...' : 'Create Grid Bot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
