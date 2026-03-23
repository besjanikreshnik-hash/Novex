'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Plus, X, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import { alertsApi, marketApi, type PriceAlertDto, type TradingPairDto } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<PriceAlertDto[]>([]);
  const [pairs, setPairs] = useState<TradingPairDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  // Form state
  const [formSymbol, setFormSymbol] = useState('BTCUSDT');
  const [formPrice, setFormPrice] = useState('');
  const [formDirection, setFormDirection] = useState<'above' | 'below'>('above');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [alertList, pairList] = await Promise.all([
        alertsApi.list().catch(() => []),
        marketApi.getPairs().catch(() => [] as TradingPairDto[]),
      ]);
      setAlerts(alertList);
      setPairs(pairList);
      if (pairList.length > 0 && !pairList.find((p) => p.symbol === formSymbol)) {
        setFormSymbol(pairList[0]!.symbol);
      }
    } catch {
      setError('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    if (!formPrice || isNaN(parseFloat(formPrice))) {
      setError('Please enter a valid price');
      return;
    }

    setCreating(true);
    setError('');
    try {
      const newAlert = await alertsApi.create(formSymbol, formPrice, formDirection);
      setAlerts((prev) => [newAlert, ...prev]);
      setFormPrice('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create alert');
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = async (alertId: string) => {
    try {
      await alertsApi.cancel(alertId);
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, status: 'cancelled' as const } : a)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel alert');
    }
  };

  const activeAlerts = alerts.filter((a) => a.status === 'active');
  const triggeredAlerts = alerts.filter((a) => a.status === 'triggered');
  const cancelledAlerts = alerts.filter((a) => a.status === 'cancelled');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] bg-nvx-bg-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-nvx-primary border-t-transparent mx-auto mb-4" />
          <p className="text-nvx-text-secondary">Loading alerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-nvx-bg-primary p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-nvx-primary/10 flex items-center justify-center">
            <Bell size={20} className="text-nvx-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-nvx-text-primary">Price Alerts</h1>
            <p className="text-xs text-nvx-text-muted">
              Get notified when a price crosses your target
            </p>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 bg-nvx-sell/10 border border-nvx-sell/30 text-nvx-sell text-xs rounded-lg px-4 py-2.5 flex items-center justify-between">
            {error}
            <button onClick={() => setError('')} className="ml-2 underline text-[10px]">
              dismiss
            </button>
          </div>
        )}

        {/* Create alert form */}
        <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-4 mb-6">
          <h2 className="text-sm font-semibold text-nvx-text-primary mb-3 flex items-center gap-2">
            <Plus size={14} />
            Create Alert
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Pair selector */}
            <div>
              <label className="block text-[10px] text-nvx-text-muted mb-1 uppercase tracking-wider">
                Pair
              </label>
              <div className="relative">
                <select
                  value={formSymbol}
                  onChange={(e) => setFormSymbol(e.target.value)}
                  className="w-full bg-nvx-bg-tertiary border border-nvx-border rounded-lg px-3 py-2 text-sm text-nvx-text-primary appearance-none cursor-pointer focus:outline-none focus:border-nvx-primary"
                >
                  {pairs.map((p) => (
                    <option key={p.symbol} value={p.symbol}>
                      {p.baseCurrency}/{p.quoteCurrency}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-nvx-text-muted pointer-events-none"
                />
              </div>
            </div>

            {/* Price input */}
            <div>
              <label className="block text-[10px] text-nvx-text-muted mb-1 uppercase tracking-wider">
                Target Price
              </label>
              <input
                type="number"
                step="any"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                placeholder="0.00"
                className="w-full bg-nvx-bg-tertiary border border-nvx-border rounded-lg px-3 py-2 text-sm text-nvx-text-primary font-mono placeholder:text-nvx-text-muted/50 focus:outline-none focus:border-nvx-primary"
              />
            </div>

            {/* Direction toggle */}
            <div>
              <label className="block text-[10px] text-nvx-text-muted mb-1 uppercase tracking-wider">
                Condition
              </label>
              <div className="flex rounded-lg border border-nvx-border overflow-hidden">
                <button
                  onClick={() => setFormDirection('above')}
                  className={cn(
                    'flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1',
                    formDirection === 'above'
                      ? 'bg-nvx-buy/20 text-nvx-buy border-r border-nvx-border'
                      : 'bg-nvx-bg-tertiary text-nvx-text-muted border-r border-nvx-border hover:text-nvx-text-secondary',
                  )}
                >
                  <ArrowUp size={12} />
                  Above
                </button>
                <button
                  onClick={() => setFormDirection('below')}
                  className={cn(
                    'flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1',
                    formDirection === 'below'
                      ? 'bg-nvx-sell/20 text-nvx-sell'
                      : 'bg-nvx-bg-tertiary text-nvx-text-muted hover:text-nvx-text-secondary',
                  )}
                >
                  <ArrowDown size={12} />
                  Below
                </button>
              </div>
            </div>

            {/* Submit */}
            <div className="flex items-end">
              <button
                onClick={handleCreate}
                disabled={creating || !formPrice}
                className={cn(
                  'w-full py-2 rounded-lg text-sm font-medium transition-colors',
                  creating || !formPrice
                    ? 'bg-nvx-primary/30 text-nvx-text-muted cursor-not-allowed'
                    : 'bg-nvx-primary text-white hover:bg-nvx-primary/80',
                )}
              >
                {creating ? 'Creating...' : 'Create Alert'}
              </button>
            </div>
          </div>
        </div>

        {/* Active alerts */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-nvx-text-primary mb-3">
            Active Alerts
            {activeAlerts.length > 0 && (
              <span className="ml-2 text-[10px] bg-nvx-primary/10 text-nvx-primary rounded px-1.5 py-0.5">
                {activeAlerts.length}
              </span>
            )}
          </h2>

          {activeAlerts.length === 0 ? (
            <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-8 text-center text-nvx-text-muted text-sm">
              No active alerts. Create one above to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {activeAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="bg-nvx-bg-secondary border border-nvx-border rounded-xl px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center',
                        alert.direction === 'above'
                          ? 'bg-nvx-buy/10'
                          : 'bg-nvx-sell/10',
                      )}
                    >
                      {alert.direction === 'above' ? (
                        <ArrowUp size={16} className="text-nvx-buy" />
                      ) : (
                        <ArrowDown size={16} className="text-nvx-sell" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-nvx-text-primary">
                        {alert.symbol}
                      </div>
                      <div className="text-xs text-nvx-text-muted">
                        {alert.direction === 'above' ? 'Price rises above' : 'Price falls below'}{' '}
                        <span className="font-mono text-nvx-text-secondary">
                          {parseFloat(alert.targetPrice).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancel(alert.id)}
                    className="text-nvx-text-muted hover:text-nvx-sell transition-colors p-1 rounded hover:bg-nvx-sell/10"
                    title="Cancel alert"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Triggered alerts */}
        {triggeredAlerts.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-nvx-text-primary mb-3">
              Triggered
              <span className="ml-2 text-[10px] bg-nvx-buy/10 text-nvx-buy rounded px-1.5 py-0.5">
                {triggeredAlerts.length}
              </span>
            </h2>
            <div className="space-y-2">
              {triggeredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="bg-nvx-bg-secondary border border-nvx-border rounded-xl px-4 py-3 flex items-center justify-between opacity-70"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-nvx-buy/10 flex items-center justify-center">
                      <Bell size={16} className="text-nvx-buy" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-nvx-text-primary">
                        {alert.symbol}
                      </div>
                      <div className="text-xs text-nvx-text-muted">
                        {alert.direction === 'above' ? 'Rose above' : 'Fell below'}{' '}
                        <span className="font-mono text-nvx-text-secondary">
                          {parseFloat(alert.targetPrice).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-nvx-text-muted">
                    {alert.triggeredAt
                      ? new Date(alert.triggeredAt).toLocaleString()
                      : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cancelled alerts */}
        {cancelledAlerts.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-nvx-text-muted mb-3">
              Cancelled ({cancelledAlerts.length})
            </h2>
            <div className="space-y-2">
              {cancelledAlerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className="bg-nvx-bg-secondary border border-nvx-border rounded-xl px-4 py-3 flex items-center justify-between opacity-40"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-nvx-bg-tertiary flex items-center justify-center">
                      <X size={16} className="text-nvx-text-muted" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-nvx-text-primary">
                        {alert.symbol}
                      </div>
                      <div className="text-xs text-nvx-text-muted">
                        {alert.direction === 'above' ? 'Above' : 'Below'}{' '}
                        <span className="font-mono">
                          {parseFloat(alert.targetPrice).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-nvx-text-muted">Cancelled</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
