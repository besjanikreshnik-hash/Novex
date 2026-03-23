'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  TrendingUp,
  Pause,
  Square,
  Play,
  RefreshCw,
  X,
  Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { copyTradingApi } from '@/lib/api';

/* ─── Types ────────────────────────────────────────── */

interface TraderProfile {
  id: string;
  userId: string;
  displayName: string;
  bio: string;
  totalFollowers: number;
  totalCopiers: number;
  winRate: string;
  totalPnl: string;
  avgReturnPercent: string;
  isPublic: boolean;
  createdAt: string;
}

interface CopyRelationship {
  id: string;
  copierId: string;
  traderId: string;
  traderDisplayName: string;
  allocationAmount: string;
  maxPositionSize: string;
  status: string;
  totalCopiedTrades: number;
  totalPnl: string;
  createdAt: string;
}

/* ─── Helpers ──────────────────────────────────────── */

function formatPnl(pnl: string): string {
  const n = parseFloat(pnl);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function formatPercent(val: string): string {
  return `${parseFloat(val).toFixed(2)}%`;
}

/* ─── Main Page ───────────────────────────────────── */

export default function CopyTradingPage() {
  const { isAuthenticated } = useAuthStore();
  const [traders, setTraders] = useState<TraderProfile[]>([]);
  const [myCopies, setMyCopies] = useState<CopyRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'traders' | 'copies'>('traders');

  // Copy modal state
  const [selectedTrader, setSelectedTrader] = useState<TraderProfile | null>(null);
  const [allocation, setAllocation] = useState('');
  const [copying, setCopying] = useState(false);

  // Detail modal
  const [detailTrader, setDetailTrader] = useState<TraderProfile | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const tradersData = await copyTradingApi.getTopTraders();
      setTraders(tradersData);
      if (isAuthenticated) {
        const copiesData = await copyTradingApi.getMyCopies();
        setMyCopies(copiesData);
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

  const handleStartCopy = async () => {
    if (!selectedTrader || !allocation) return;
    setCopying(true);
    try {
      await copyTradingApi.startCopying(selectedTrader.userId, allocation);
      setSelectedTrader(null);
      setAllocation('');
      await fetchData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCopying(false);
    }
  };

  const handleStopCopy = async (traderId: string) => {
    try {
      await copyTradingApi.stopCopying(traderId);
      await fetchData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handlePauseCopy = async (traderId: string) => {
    try {
      await copyTradingApi.pauseCopying(traderId);
      await fetchData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleResumeCopy = async (traderId: string) => {
    try {
      await copyTradingApi.resumeCopying(traderId);
      await fetchData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Users size={24} className="text-nvx-primary" />
          <h1 className="text-2xl font-bold text-nvx-text-primary">Copy Trading</h1>
        </div>
        <p className="text-sm text-nvx-text-secondary ml-9">
          Follow top traders and automatically copy their trades
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-nvx-bg-secondary border border-nvx-border rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('traders')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
            tab === 'traders'
              ? 'bg-nvx-primary text-white shadow-sm'
              : 'text-nvx-text-secondary hover:text-nvx-text-primary hover:bg-nvx-bg-tertiary',
          )}
        >
          Top Traders
        </button>
        <button
          onClick={() => setTab('copies')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
            tab === 'copies'
              ? 'bg-nvx-primary text-white shadow-sm'
              : 'text-nvx-text-secondary hover:text-nvx-text-primary hover:bg-nvx-bg-tertiary',
          )}
        >
          My Copies
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

      {/* Top Traders Grid */}
      {!loading && !error && tab === 'traders' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {traders.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-sm text-nvx-text-muted">
              <Users size={32} className="mb-3 opacity-30" />
              No traders available yet
            </div>
          )}
          {traders.map((trader) => {
            const pnl = parseFloat(trader.totalPnl);
            return (
              <div
                key={trader.id}
                className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-5 hover:border-nvx-primary/40 transition-colors"
              >
                {/* Trader header */}
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => setDetailTrader(trader)}
                  >
                    <div className="w-10 h-10 rounded-full bg-nvx-primary/20 flex items-center justify-center">
                      <span className="text-sm font-bold text-nvx-primary">
                        {trader.displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-nvx-text-primary">{trader.displayName}</p>
                      <p className="text-xs text-nvx-text-muted">{trader.totalCopiers} copiers</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedTrader(trader)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-nvx-primary text-white rounded-lg hover:bg-nvx-primary/90 transition-colors"
                  >
                    <Copy size={12} />
                    Copy
                  </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-nvx-text-muted mb-0.5">Win Rate</p>
                    <p className="text-sm font-semibold text-nvx-text-primary">
                      {formatPercent(trader.winRate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-nvx-text-muted mb-0.5">Total PnL</p>
                    <p className={cn(
                      'text-sm font-semibold',
                      pnl >= 0 ? 'text-nvx-buy' : 'text-nvx-sell',
                    )}>
                      {formatPnl(trader.totalPnl)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-nvx-text-muted mb-0.5">Avg Return</p>
                    <p className={cn(
                      'text-sm font-semibold',
                      parseFloat(trader.avgReturnPercent) >= 0 ? 'text-nvx-buy' : 'text-nvx-sell',
                    )}>
                      {formatPercent(trader.avgReturnPercent)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* My Copies */}
      {!loading && !error && tab === 'copies' && (
        <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[1fr_120px_120px_100px_80px_140px] gap-4 px-5 py-3 border-b border-nvx-border text-xs font-semibold text-nvx-text-secondary uppercase tracking-wider">
            <div>Trader</div>
            <div className="text-right">Allocation</div>
            <div className="text-right">PnL</div>
            <div className="text-right">Trades</div>
            <div className="text-center">Status</div>
            <div className="text-right">Actions</div>
          </div>

          {myCopies.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-sm text-nvx-text-muted">
              <Copy size={32} className="mb-3 opacity-30" />
              You are not copying anyone yet
            </div>
          )}

          {myCopies.map((copy) => {
            const pnl = parseFloat(copy.totalPnl);
            return (
              <div
                key={copy.id}
                className="grid grid-cols-[1fr_120px_120px_100px_80px_140px] gap-4 px-5 py-3 items-center border-b border-nvx-border/50 last:border-b-0 hover:bg-nvx-bg-tertiary/50 transition-colors"
              >
                <div className="text-sm font-medium text-nvx-text-primary">{copy.traderDisplayName}</div>
                <div className="text-sm font-mono text-right text-nvx-text-secondary">
                  ${parseFloat(copy.allocationAmount).toFixed(2)}
                </div>
                <div className={cn(
                  'text-sm font-mono text-right',
                  pnl >= 0 ? 'text-nvx-buy' : 'text-nvx-sell',
                )}>
                  {formatPnl(copy.totalPnl)}
                </div>
                <div className="text-sm font-mono text-right text-nvx-text-secondary">
                  {copy.totalCopiedTrades}
                </div>
                <div className="text-center">
                  <span className={cn(
                    'inline-block px-2 py-0.5 text-2xs font-semibold rounded',
                    copy.status === 'active' && 'bg-nvx-buy/20 text-nvx-buy',
                    copy.status === 'paused' && 'bg-yellow-500/20 text-yellow-400',
                    copy.status === 'stopped' && 'bg-nvx-sell/20 text-nvx-sell',
                  )}>
                    {copy.status}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-1">
                  {copy.status === 'active' && (
                    <button
                      onClick={() => handlePauseCopy(copy.traderId)}
                      className="p-1.5 text-nvx-text-secondary hover:text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-colors"
                      title="Pause"
                    >
                      <Pause size={14} />
                    </button>
                  )}
                  {copy.status === 'paused' && (
                    <button
                      onClick={() => handleResumeCopy(copy.traderId)}
                      className="p-1.5 text-nvx-text-secondary hover:text-nvx-buy hover:bg-nvx-buy/10 rounded-lg transition-colors"
                      title="Resume"
                    >
                      <Play size={14} />
                    </button>
                  )}
                  {copy.status !== 'stopped' && (
                    <button
                      onClick={() => handleStopCopy(copy.traderId)}
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

      {/* Copy Modal */}
      {selectedTrader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-nvx-bg-secondary border border-nvx-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-nvx-text-primary">
                Copy {selectedTrader.displayName}
              </h2>
              <button
                onClick={() => setSelectedTrader(null)}
                className="p-1 text-nvx-text-secondary hover:text-nvx-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-nvx-bg-tertiary rounded-lg p-3">
                <p className="text-xs text-nvx-text-muted">Win Rate</p>
                <p className="text-sm font-semibold text-nvx-text-primary">
                  {formatPercent(selectedTrader.winRate)}
                </p>
              </div>
              <div className="bg-nvx-bg-tertiary rounded-lg p-3">
                <p className="text-xs text-nvx-text-muted">Total PnL</p>
                <p className="text-sm font-semibold text-nvx-buy">
                  {formatPnl(selectedTrader.totalPnl)}
                </p>
              </div>
              <div className="bg-nvx-bg-tertiary rounded-lg p-3">
                <p className="text-xs text-nvx-text-muted">Copiers</p>
                <p className="text-sm font-semibold text-nvx-text-primary">
                  {selectedTrader.totalCopiers}
                </p>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-medium text-nvx-text-secondary mb-1.5">
                Allocation Amount (USDT)
              </label>
              <input
                type="number"
                value={allocation}
                onChange={(e) => setAllocation(e.target.value)}
                placeholder="e.g. 1000"
                className="w-full px-3 py-2.5 bg-nvx-bg-tertiary border border-nvx-border rounded-lg text-sm text-nvx-text-primary placeholder:text-nvx-text-muted focus:outline-none focus:ring-1 focus:ring-nvx-primary"
              />
            </div>

            <button
              onClick={handleStartCopy}
              disabled={copying || !allocation}
              className="w-full py-2.5 text-sm font-semibold text-white bg-nvx-primary hover:bg-nvx-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {copying ? 'Starting...' : 'Start Copying'}
            </button>
          </div>
        </div>
      )}

      {/* Trader Detail Modal */}
      {detailTrader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-nvx-bg-secondary border border-nvx-border rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-nvx-primary/20 flex items-center justify-center">
                  <span className="text-lg font-bold text-nvx-primary">
                    {detailTrader.displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-nvx-text-primary">{detailTrader.displayName}</h2>
                  <p className="text-xs text-nvx-text-muted">
                    Joined {new Date(detailTrader.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailTrader(null)}
                className="p-1 text-nvx-text-secondary hover:text-nvx-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            {detailTrader.bio && (
              <p className="text-sm text-nvx-text-secondary mb-5">{detailTrader.bio}</p>
            )}

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-nvx-bg-tertiary rounded-lg p-4">
                <p className="text-xs text-nvx-text-muted mb-1">Win Rate</p>
                <p className="text-xl font-bold text-nvx-text-primary">
                  {formatPercent(detailTrader.winRate)}
                </p>
              </div>
              <div className="bg-nvx-bg-tertiary rounded-lg p-4">
                <p className="text-xs text-nvx-text-muted mb-1">Total PnL</p>
                <p className={cn(
                  'text-xl font-bold',
                  parseFloat(detailTrader.totalPnl) >= 0 ? 'text-nvx-buy' : 'text-nvx-sell',
                )}>
                  {formatPnl(detailTrader.totalPnl)}
                </p>
              </div>
              <div className="bg-nvx-bg-tertiary rounded-lg p-4">
                <p className="text-xs text-nvx-text-muted mb-1">Avg Return</p>
                <p className={cn(
                  'text-xl font-bold',
                  parseFloat(detailTrader.avgReturnPercent) >= 0 ? 'text-nvx-buy' : 'text-nvx-sell',
                )}>
                  {formatPercent(detailTrader.avgReturnPercent)}
                </p>
              </div>
              <div className="bg-nvx-bg-tertiary rounded-lg p-4">
                <p className="text-xs text-nvx-text-muted mb-1">Followers / Copiers</p>
                <p className="text-xl font-bold text-nvx-text-primary">
                  {detailTrader.totalFollowers} / {detailTrader.totalCopiers}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setDetailTrader(null);
                setSelectedTrader(detailTrader);
              }}
              className="w-full py-2.5 text-sm font-semibold text-white bg-nvx-primary hover:bg-nvx-primary/90 rounded-lg transition-colors"
            >
              Copy This Trader
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
