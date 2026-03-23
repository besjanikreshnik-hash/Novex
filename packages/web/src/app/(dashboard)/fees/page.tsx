'use client';

import { useState, useEffect, useCallback } from 'react';
import { Crown, TrendingUp, Loader2 } from 'lucide-react';
import {
  feeTiersApi,
  type FeeTierDto,
  type UserTierDto,
} from '@/lib/api';

export default function FeesPage() {
  const [tiers, setTiers] = useState<FeeTierDto[]>([]);
  const [myTier, setMyTier] = useState<UserTierDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allTiers, userTier] = await Promise.all([
        feeTiersApi.getAll(),
        feeTiersApi.getMy().catch(() => null),
      ]);
      setTiers(allTiers);
      setMyTier(userTier);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fee tiers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] bg-nvx-bg-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-nvx-primary border-t-transparent mx-auto mb-4" />
          <p className="text-nvx-text-secondary text-sm">Loading fee tiers...</p>
        </div>
      </div>
    );
  }

  const volume30d = myTier ? parseFloat(myTier.volume30d) : 0;
  const nextTierVolume = myTier?.nextTier
    ? parseFloat(myTier.nextTier.minVolume30d)
    : volume30d;
  const currentTierVolume = myTier
    ? parseFloat(
        tiers.find((t) => t.tier === myTier.tier)?.minVolume30d || '0',
      )
    : 0;
  const progressRange = nextTierVolume - currentTierVolume;
  const progressPct =
    progressRange > 0
      ? Math.min(((volume30d - currentTierVolume) / progressRange) * 100, 100)
      : 100;

  return (
    <div className="bg-nvx-bg-primary min-h-[calc(100vh-56px)] p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-nvx-text-primary flex items-center gap-2">
            <Crown size={22} className="text-nvx-primary" />
            Fee Tiers
          </h1>
          <p className="text-sm text-nvx-text-muted mt-1">
            Trade more to unlock lower fees and VIP benefits
          </p>
        </div>

        {error && (
          <div className="bg-nvx-sell/10 border border-nvx-sell/30 text-nvx-sell text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* My Current Tier Card */}
        {myTier && (
          <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-5 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-nvx-primary/20 flex items-center justify-center">
                  <Crown size={24} className="text-nvx-primary" />
                </div>
                <div>
                  <p className="text-xs text-nvx-text-muted uppercase tracking-wider">
                    Your Current Tier
                  </p>
                  <p className="text-lg font-bold text-nvx-text-primary">
                    {myTier.name}
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-right">
                  <p className="text-xs text-nvx-text-muted">Maker Fee</p>
                  <p className="text-base font-bold text-nvx-buy font-mono">
                    {(parseFloat(myTier.makerFeeRate) * 100).toFixed(2)}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-nvx-text-muted">Taker Fee</p>
                  <p className="text-base font-bold text-nvx-buy font-mono">
                    {(parseFloat(myTier.takerFeeRate) * 100).toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Volume and progress */}
            <div className="bg-nvx-bg-primary rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-nvx-text-muted">
                  30-Day Trading Volume
                </span>
                <span className="text-sm font-mono font-semibold text-nvx-text-primary">
                  ${volume30d.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              {myTier.nextTier && (
                <>
                  <div className="w-full bg-nvx-bg-tertiary rounded-full h-2.5 mb-2">
                    <div
                      className="bg-nvx-primary h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-nvx-text-muted">
                    <span className="flex items-center gap-1">
                      <TrendingUp size={12} />
                      Next: {myTier.nextTier.name}
                    </span>
                    <span className="font-mono">
                      ${parseFloat(myTier.nextTier.volumeNeeded).toLocaleString(
                        undefined,
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                      )}{' '}
                      needed
                    </span>
                  </div>
                </>
              )}
              {!myTier.nextTier && (
                <p className="text-xs text-nvx-buy mt-1">
                  You have reached the highest VIP tier!
                </p>
              )}
            </div>
          </div>
        )}

        {/* Fee Tier Table */}
        <h2 className="text-base font-semibold text-nvx-text-primary mb-3">
          All Fee Tiers
        </h2>
        <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-nvx-border text-nvx-text-muted text-xs">
                  <th className="text-left py-3 px-4 font-medium">Tier</th>
                  <th className="text-right py-3 px-4 font-medium">
                    30d Volume Required
                  </th>
                  <th className="text-right py-3 px-4 font-medium">
                    Maker Fee
                  </th>
                  <th className="text-right py-3 px-4 font-medium">
                    Taker Fee
                  </th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((tier) => {
                  const isCurrent = myTier?.tier === tier.tier;
                  return (
                    <tr
                      key={tier.id}
                      className={`border-b border-nvx-border/30 transition-colors ${
                        isCurrent
                          ? 'bg-nvx-primary/5 border-l-2 border-l-nvx-primary'
                          : 'hover:bg-nvx-bg-tertiary/30'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {isCurrent && (
                            <Crown size={14} className="text-nvx-primary" />
                          )}
                          <span
                            className={`text-sm font-medium ${
                              isCurrent
                                ? 'text-nvx-primary'
                                : 'text-nvx-text-primary'
                            }`}
                          >
                            {tier.name}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] bg-nvx-primary/20 text-nvx-primary px-1.5 py-0.5 rounded font-medium">
                              Current
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm text-nvx-text-primary">
                        {parseFloat(tier.minVolume30d) === 0
                          ? '-'
                          : `$${parseFloat(tier.minVolume30d).toLocaleString()}`}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm text-nvx-buy">
                        {(parseFloat(tier.makerFeeRate) * 100).toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm text-nvx-text-primary">
                        {(parseFloat(tier.takerFeeRate) * 100).toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
                {tiers.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="text-center py-12 text-nvx-text-muted text-sm"
                    >
                      No fee tiers configured.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
