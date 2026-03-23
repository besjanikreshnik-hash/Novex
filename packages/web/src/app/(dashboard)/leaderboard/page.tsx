'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, Medal, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { useTranslation } from '@/lib/i18n/context';

/* ─── Types ────────────────────────────────────────── */

interface LeaderboardEntry {
  rank: number;
  maskedEmail: string;
  totalVolume: string;
  tradeCount: number;
  topPair: string;
}

type Period = '24h' | '7d' | '30d' | 'all';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/* ─── Rank Badge ──────────────────────────────────── */

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/20">
        <Trophy size={16} className="text-yellow-400" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-300/20">
        <Medal size={16} className="text-gray-300" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-600/20">
        <Medal size={16} className="text-amber-600" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-8 h-8">
      <span className="text-sm font-mono text-nvx-text-secondary">{rank}</span>
    </div>
  );
}

/* ─── Format Volume ────────────────────────────────── */

function formatVolume(vol: string): string {
  const n = parseFloat(vol);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(2);
}

/* ─── Main Page ───────────────────────────────────── */

export default function LeaderboardPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [period, setPeriod] = useState<Period>('24h');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${BASE_URL}/leaderboard?period=${period}&limit=50`);
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      const data = await res.json();
      setEntries(data.entries || []);
    } catch {
      setError('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchLeaderboard, 60_000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  const periods: { value: Period; labelKey: 'leaderboard_24h' | 'leaderboard_7d' | 'leaderboard_30d' | 'leaderboard_all' }[] = [
    { value: '24h', labelKey: 'leaderboard_24h' },
    { value: '7d', labelKey: 'leaderboard_7d' },
    { value: '30d', labelKey: 'leaderboard_30d' },
    { value: 'all', labelKey: 'leaderboard_all' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Trophy size={24} className="text-yellow-400" />
          <h1 className="text-2xl font-bold text-nvx-text-primary">{t('leaderboard_title')}</h1>
        </div>
        <p className="text-sm text-nvx-text-secondary ml-9">{t('leaderboard_subtitle')}</p>
      </div>

      {/* Period Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-nvx-bg-secondary border border-nvx-border rounded-xl p-1 w-fit">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
              period === p.value
                ? 'bg-nvx-primary text-white shadow-sm'
                : 'text-nvx-text-secondary hover:text-nvx-text-primary hover:bg-nvx-bg-tertiary',
            )}
          >
            {t(p.labelKey)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[60px_1fr_140px_100px_120px] gap-4 px-5 py-3 border-b border-nvx-border text-xs font-semibold text-nvx-text-secondary uppercase tracking-wider">
          <div>{t('leaderboard_rank')}</div>
          <div>{t('leaderboard_trader')}</div>
          <div className="text-right">{t('leaderboard_volume')}</div>
          <div className="text-right">{t('leaderboard_trades')}</div>
          <div className="text-right">{t('leaderboard_top_pair')}</div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={20} className="text-nvx-primary animate-spin" />
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="flex items-center justify-center py-16 text-sm text-nvx-sell">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-sm text-nvx-text-muted">
            <Trophy size={32} className="mb-3 opacity-30" />
            {t('leaderboard_no_data')}
          </div>
        )}

        {/* Data Rows */}
        {!loading && !error && entries.map((entry) => {
          const isTop3 = entry.rank <= 3;
          // Check if this might be the current user by matching masked email pattern
          const isCurrentUser = false; // Server doesn't expose userId in response for privacy

          return (
            <div
              key={entry.rank}
              className={cn(
                'grid grid-cols-[60px_1fr_140px_100px_120px] gap-4 px-5 py-3 items-center transition-colors',
                'border-b border-nvx-border/50 last:border-b-0',
                isTop3 && entry.rank === 1 && 'bg-yellow-500/5',
                isTop3 && entry.rank === 2 && 'bg-gray-300/5',
                isTop3 && entry.rank === 3 && 'bg-amber-600/5',
                isCurrentUser && 'bg-nvx-primary/10 border-l-2 border-l-nvx-primary',
                !isTop3 && !isCurrentUser && 'hover:bg-nvx-bg-tertiary/50',
              )}
            >
              {/* Rank */}
              <div className="flex items-center">
                <RankBadge rank={entry.rank} />
              </div>

              {/* Trader */}
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-sm font-medium font-mono',
                    isTop3 ? 'text-nvx-text-primary' : 'text-nvx-text-secondary',
                  )}
                >
                  {entry.maskedEmail}
                </span>
                {isCurrentUser && (
                  <span className="px-1.5 py-0.5 text-2xs font-semibold bg-nvx-primary/20 text-nvx-primary rounded">
                    {t('leaderboard_you')}
                  </span>
                )}
              </div>

              {/* Volume */}
              <div
                className={cn(
                  'text-sm font-mono text-right',
                  isTop3 ? 'text-nvx-text-primary font-semibold' : 'text-nvx-text-secondary',
                )}
              >
                {formatVolume(entry.totalVolume)}
              </div>

              {/* Trades */}
              <div className="text-sm font-mono text-right text-nvx-text-secondary">
                {entry.tradeCount.toLocaleString()}
              </div>

              {/* Top Pair */}
              <div className="text-sm font-mono text-right text-nvx-text-secondary">
                {entry.topPair}
              </div>
            </div>
          );
        })}
      </div>

      {/* Auto-refresh notice */}
      <p className="text-xs text-nvx-text-muted mt-3 text-center">
        Auto-refreshes every 60 seconds
      </p>
    </div>
  );
}
