'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Coins, Lock, Unlock, TrendingUp, Clock, X, Loader2 } from 'lucide-react';
import {
  stakingApi,
  type StakingProductDto,
  type StakingPositionDto,
} from '@/lib/api';

export default function EarnPage() {
  const [products, setProducts] = useState<StakingProductDto[]>([]);
  const [positions, setPositions] = useState<StakingPositionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Stake modal state
  const [stakeModal, setStakeModal] = useState<StakingProductDto | null>(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [stakeLoading, setStakeLoading] = useState(false);
  const [stakeError, setStakeError] = useState('');

  // Unstake loading
  const [unstakeLoading, setUnstakeLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prods, pos] = await Promise.all([
        stakingApi.getProducts(),
        stakingApi.getPositions().catch(() => [] as StakingPositionDto[]),
      ]);
      setProducts(prods);
      setPositions(pos);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load staking data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Total earned rewards
  const totalEarned = useMemo(() => {
    return positions.reduce((sum, p) => {
      return sum + parseFloat(p.currentReward || '0');
    }, 0);
  }, [positions]);

  // Total staked value
  const totalStaked = useMemo(() => {
    return positions
      .filter((p) => p.status === 'active')
      .reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);
  }, [positions]);

  const activePositions = useMemo(
    () => positions.filter((p) => p.status === 'active'),
    [positions],
  );

  // Handle stake
  const handleStake = async () => {
    if (!stakeModal || !stakeAmount) return;
    setStakeLoading(true);
    setStakeError('');
    try {
      await stakingApi.stake(stakeModal.id, stakeAmount);
      setStakeModal(null);
      setStakeAmount('');
      await loadData();
    } catch (err) {
      setStakeError(err instanceof Error ? err.message : 'Stake failed');
    } finally {
      setStakeLoading(false);
    }
  };

  // Handle unstake
  const handleUnstake = async (positionId: string) => {
    setUnstakeLoading(positionId);
    try {
      await stakingApi.unstake(positionId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unstake failed');
    } finally {
      setUnstakeLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] bg-nvx-bg-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-nvx-primary border-t-transparent mx-auto mb-4" />
          <p className="text-nvx-text-secondary text-sm">Loading earn products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-nvx-bg-primary min-h-[calc(100vh-56px)] p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-nvx-text-primary flex items-center gap-2">
              <Coins size={22} className="text-nvx-primary" />
              Earn
            </h1>
            <p className="text-sm text-nvx-text-muted mt-1">
              Stake your crypto and earn passive rewards
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-4">
            <p className="text-xs text-nvx-text-muted uppercase tracking-wider mb-1">
              Total Staked
            </p>
            <p className="text-lg font-bold text-nvx-text-primary font-mono">
              {totalStaked.toFixed(4)}
            </p>
            <p className="text-xs text-nvx-text-muted mt-0.5">
              across {activePositions.length} position{activePositions.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-4">
            <p className="text-xs text-nvx-text-muted uppercase tracking-wider mb-1">
              Total Rewards Earned
            </p>
            <p className="text-lg font-bold text-nvx-buy font-mono">
              +{totalEarned.toFixed(8)}
            </p>
          </div>
          <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-4">
            <p className="text-xs text-nvx-text-muted uppercase tracking-wider mb-1">
              Active Products
            </p>
            <p className="text-lg font-bold text-nvx-text-primary font-mono">
              {products.length}
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-nvx-sell/10 border border-nvx-sell/30 text-nvx-sell text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* Staking Products */}
        <h2 className="text-base font-semibold text-nvx-text-primary mb-3">
          Staking Products
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-5 hover:border-nvx-primary/40 transition-colors"
            >
              {/* Asset badge */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-nvx-primary/20 flex items-center justify-center text-nvx-primary text-xs font-bold">
                    {product.asset.slice(0, 1)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-nvx-text-primary">
                      {product.asset}
                    </p>
                    <p className="text-xs text-nvx-text-muted">{product.name}</p>
                  </div>
                </div>
                {product.lockDays > 0 ? (
                  <Lock size={14} className="text-nvx-text-muted" />
                ) : (
                  <Unlock size={14} className="text-nvx-buy" />
                )}
              </div>

              {/* APY */}
              <div className="mb-4">
                <p className="text-xs text-nvx-text-muted mb-0.5">APY</p>
                <p className="text-2xl font-bold text-nvx-buy">
                  {parseFloat(product.annualRate).toFixed(1)}%
                </p>
              </div>

              {/* Details */}
              <div className="space-y-2 text-xs mb-4">
                <div className="flex justify-between text-nvx-text-secondary">
                  <span>Lock Period</span>
                  <span className="text-nvx-text-primary font-medium">
                    {product.lockDays === 0 ? 'Flexible' : `${product.lockDays} days`}
                  </span>
                </div>
                <div className="flex justify-between text-nvx-text-secondary">
                  <span>Min Amount</span>
                  <span className="text-nvx-text-primary font-mono">
                    {product.minAmount} {product.asset}
                  </span>
                </div>
                {parseFloat(product.maxAmount) > 0 && (
                  <div className="flex justify-between text-nvx-text-secondary">
                    <span>Max Amount</span>
                    <span className="text-nvx-text-primary font-mono">
                      {product.maxAmount} {product.asset}
                    </span>
                  </div>
                )}
              </div>

              {/* Stake button */}
              <button
                onClick={() => {
                  setStakeModal(product);
                  setStakeAmount('');
                  setStakeError('');
                }}
                className="w-full py-2 px-4 rounded-lg bg-nvx-primary text-white text-sm font-medium hover:bg-nvx-primary/90 transition-colors"
              >
                Stake {product.asset}
              </button>
            </div>
          ))}

          {products.length === 0 && (
            <div className="col-span-full text-center py-12 text-nvx-text-muted text-sm">
              No staking products available at this time.
            </div>
          )}
        </div>

        {/* My Positions */}
        <h2 className="text-base font-semibold text-nvx-text-primary mb-3">
          My Positions
        </h2>
        <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-nvx-border text-nvx-text-muted text-xs">
                  <th className="text-left py-3 px-4 font-medium">Asset</th>
                  <th className="text-right py-3 px-4 font-medium">Amount</th>
                  <th className="text-right py-3 px-4 font-medium">APY</th>
                  <th className="text-right py-3 px-4 font-medium">Earned</th>
                  <th className="text-right py-3 px-4 font-medium">Time Remaining</th>
                  <th className="text-right py-3 px-4 font-medium">Status</th>
                  <th className="text-right py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {positions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-nvx-text-muted text-sm">
                      No staking positions yet. Stake some crypto to start earning.
                    </td>
                  </tr>
                ) : (
                  positions.map((pos) => {
                    const timeRemaining = getTimeRemaining(pos.endDate);
                    const canUnstake =
                      pos.status === 'active' &&
                      (!pos.endDate || new Date(pos.endDate) <= new Date());

                    return (
                      <tr
                        key={pos.id}
                        className="border-b border-nvx-border/30 hover:bg-nvx-bg-tertiary/30 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-nvx-primary/20 flex items-center justify-center text-nvx-primary text-[10px] font-bold">
                              {pos.asset.slice(0, 1)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-nvx-text-primary">
                                {pos.asset}
                              </p>
                              <p className="text-[10px] text-nvx-text-muted">
                                {pos.productName}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm text-nvx-text-primary">
                          {parseFloat(pos.amount).toFixed(6)}
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-nvx-buy font-medium">
                          {parseFloat(pos.annualRate).toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm text-nvx-buy">
                          +{parseFloat(pos.currentReward).toFixed(8)}
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-nvx-text-secondary">
                          <span className="flex items-center justify-end gap-1">
                            <Clock size={12} />
                            {timeRemaining}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                              pos.status === 'active'
                                ? 'bg-nvx-buy/10 text-nvx-buy'
                                : pos.status === 'completed'
                                  ? 'bg-nvx-text-muted/10 text-nvx-text-muted'
                                  : 'bg-nvx-sell/10 text-nvx-sell'
                            }`}
                          >
                            {pos.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {pos.status === 'active' && (
                            <button
                              onClick={() => handleUnstake(pos.id)}
                              disabled={!canUnstake || unstakeLoading === pos.id}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded transition-colors ${
                                canUnstake
                                  ? 'text-nvx-sell bg-nvx-sell/10 hover:bg-nvx-sell/20'
                                  : 'text-nvx-text-muted bg-nvx-bg-tertiary cursor-not-allowed'
                              }`}
                              title={
                                canUnstake ? 'Unstake and claim rewards' : 'Lock period not expired'
                              }
                            >
                              {unstakeLoading === pos.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Unlock size={12} />
                              )}
                              Unstake
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Stake Modal */}
      {stakeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl w-full max-w-md mx-4 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-nvx-text-primary">
                Stake {stakeModal.asset}
              </h3>
              <button
                onClick={() => setStakeModal(null)}
                className="p-1 rounded hover:bg-nvx-bg-tertiary text-nvx-text-muted transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="bg-nvx-bg-primary rounded-lg p-3">
                <div className="flex justify-between text-xs text-nvx-text-muted mb-1">
                  <span>Product</span>
                  <span>{stakeModal.name}</span>
                </div>
                <div className="flex justify-between text-xs text-nvx-text-muted mb-1">
                  <span>APY</span>
                  <span className="text-nvx-buy font-medium">
                    {parseFloat(stakeModal.annualRate).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-xs text-nvx-text-muted mb-1">
                  <span>Lock Period</span>
                  <span>
                    {stakeModal.lockDays === 0
                      ? 'Flexible (no lock)'
                      : `${stakeModal.lockDays} days`}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-nvx-text-muted">
                  <span>Min Amount</span>
                  <span>
                    {stakeModal.minAmount} {stakeModal.asset}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs text-nvx-text-muted mb-1">
                  Amount ({stakeModal.asset})
                </label>
                <input
                  type="number"
                  step="any"
                  min={stakeModal.minAmount}
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder={`Min: ${stakeModal.minAmount}`}
                  className="w-full px-3 py-2.5 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary placeholder-nvx-text-muted focus:outline-none focus:border-nvx-primary font-mono"
                />
              </div>

              {stakeAmount && parseFloat(stakeAmount) > 0 && (
                <div className="bg-nvx-buy/5 border border-nvx-buy/20 rounded-lg p-3">
                  <p className="text-xs text-nvx-text-muted mb-1">Estimated Daily Reward</p>
                  <p className="text-sm font-mono text-nvx-buy">
                    +
                    {(
                      (parseFloat(stakeAmount) * parseFloat(stakeModal.annualRate)) /
                      100 /
                      365
                    ).toFixed(8)}{' '}
                    {stakeModal.asset}
                  </p>
                </div>
              )}
            </div>

            {stakeError && (
              <div className="bg-nvx-sell/10 border border-nvx-sell/30 text-nvx-sell text-xs rounded-lg px-3 py-2 mb-3">
                {stakeError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStakeModal(null)}
                className="flex-1 py-2.5 px-4 rounded-lg border border-nvx-border text-sm font-medium text-nvx-text-secondary hover:bg-nvx-bg-tertiary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStake}
                disabled={
                  stakeLoading ||
                  !stakeAmount ||
                  parseFloat(stakeAmount) < parseFloat(stakeModal.minAmount)
                }
                className="flex-1 py-2.5 px-4 rounded-lg bg-nvx-primary text-white text-sm font-medium hover:bg-nvx-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {stakeLoading && <Loader2 size={14} className="animate-spin" />}
                Confirm Stake
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getTimeRemaining(endDate: string | null): string {
  if (!endDate) return 'Flexible';
  const end = new Date(endDate);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  if (diffMs <= 0) return 'Unlocked';
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}
