'use client';

import { useState, useEffect, useCallback } from 'react';
import { Copy, Check, Users, Gift, Trophy, RefreshCw } from 'lucide-react';
import { referralApi, type ReferralDto, type ReferralStatsDto } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function ReferralPage() {
  const [code, setCode] = useState('');
  const [stats, setStats] = useState<ReferralStatsDto | null>(null);
  const [referrals, setReferrals] = useState<ReferralDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const referralLink = code ? `https://novex.io/register?ref=${code}` : '';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [codeRes, statsRes, listRes] = await Promise.all([
        referralApi.getCode(),
        referralApi.getStats(),
        referralApi.listReferrals(),
      ]);
      setCode(codeRes.code);
      setStats(statsRes);
      setReferrals(listRes.referrals);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load referral data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopy = async (text: string, type: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback for browsers that don't support clipboard API
    }
  };

  const maskEmail = (referredId: string) => {
    // We only have the userId, so display a masked version
    const short = referredId.slice(0, 8);
    return `user-${short}...`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] bg-nvx-bg-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-nvx-primary border-t-transparent mx-auto mb-4" />
          <p className="text-nvx-text-secondary">Loading referral data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-nvx-bg-primary p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-nvx-text-primary">Referral Program</h1>
            <p className="text-sm text-nvx-text-muted mt-1">
              Invite friends and earn rewards when they start trading
            </p>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-nvx-text-secondary hover:text-nvx-text-primary bg-nvx-bg-secondary border border-nvx-border rounded-lg transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="bg-nvx-sell/10 border border-nvx-sell/30 text-nvx-sell text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Referral Code & Link */}
        <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-nvx-text-primary mb-4">Your Referral Code</h2>

          <div className="space-y-4">
            {/* Code */}
            <div>
              <label className="text-xs text-nvx-text-muted mb-1.5 block">Code</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-nvx-bg-tertiary border border-nvx-border rounded-lg px-4 py-2.5 font-mono text-lg tracking-widest text-nvx-primary">
                  {code}
                </div>
                <button
                  onClick={() => handleCopy(code, 'code')}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-nvx-bg-tertiary border border-nvx-border rounded-lg text-sm text-nvx-text-secondary hover:text-nvx-text-primary transition-colors"
                >
                  {copied === 'code' ? <Check size={14} className="text-nvx-buy" /> : <Copy size={14} />}
                  {copied === 'code' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Link */}
            <div>
              <label className="text-xs text-nvx-text-muted mb-1.5 block">Shareable Link</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-nvx-bg-tertiary border border-nvx-border rounded-lg px-4 py-2.5 text-sm text-nvx-text-secondary truncate">
                  {referralLink}
                </div>
                <button
                  onClick={() => handleCopy(referralLink, 'link')}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-nvx-primary hover:bg-nvx-primary/90 rounded-lg text-sm text-white font-medium transition-colors"
                >
                  {copied === 'link' ? <Check size={14} /> : <Copy size={14} />}
                  {copied === 'link' ? 'Copied' : 'Copy Link'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Users size={18} className="text-blue-400" />
                </div>
                <span className="text-xs text-nvx-text-muted">Total Referrals</span>
              </div>
              <div className="text-2xl font-bold text-nvx-text-primary">{stats.totalReferrals}</div>
              <div className="text-xs text-nvx-text-muted mt-1">
                {stats.activeReferrals} active
              </div>
            </div>

            <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-nvx-buy/10 flex items-center justify-center">
                  <Trophy size={18} className="text-nvx-buy" />
                </div>
                <span className="text-xs text-nvx-text-muted">Rewarded</span>
              </div>
              <div className="text-2xl font-bold text-nvx-text-primary">{stats.rewardedReferrals}</div>
              <div className="text-xs text-nvx-text-muted mt-1">completed referrals</div>
            </div>

            <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-nvx-primary/10 flex items-center justify-center">
                  <Gift size={18} className="text-nvx-primary" />
                </div>
                <span className="text-xs text-nvx-text-muted">Total Rewards</span>
              </div>
              <div className="text-2xl font-bold text-nvx-text-primary">
                {parseFloat(stats.totalRewards).toFixed(2)} <span className="text-sm text-nvx-text-muted">{stats.rewardCurrency}</span>
              </div>
              <div className="text-xs text-nvx-text-muted mt-1">earned so far</div>
            </div>
          </div>
        )}

        {/* Referrals Table */}
        <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-nvx-border">
            <h2 className="text-sm font-semibold text-nvx-text-primary">Referral History</h2>
          </div>

          {referrals.length === 0 ? (
            <div className="px-5 py-12 text-center text-nvx-text-muted text-sm">
              No referrals yet. Share your code to start earning rewards!
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-nvx-text-muted border-b border-nvx-border">
                  <th className="text-left px-5 py-3 font-medium text-xs">Date</th>
                  <th className="text-left px-5 py-3 font-medium text-xs">User</th>
                  <th className="text-left px-5 py-3 font-medium text-xs">Status</th>
                  <th className="text-right px-5 py-3 font-medium text-xs">Reward</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => (
                  <tr key={r.id} className="border-b border-nvx-border/50 hover:bg-nvx-bg-tertiary/50">
                    <td className="px-5 py-3 text-nvx-text-secondary">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-nvx-text-secondary font-mono text-xs">
                      {maskEmail(r.referredId)}
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        r.status === 'pending' && 'bg-yellow-500/10 text-yellow-400',
                        r.status === 'active' && 'bg-blue-500/10 text-blue-400',
                        r.status === 'rewarded' && 'bg-nvx-buy/10 text-nvx-buy',
                      )}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-nvx-text-primary font-mono">
                      {parseFloat(r.rewardAmount).toFixed(2)} {r.rewardCurrency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
