'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Search, RefreshCw, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { walletApi, marketApi, type BalanceDto, type TradingPairDto } from '@/lib/api';
import { useAccountStream } from '@/hooks/useWebSocket';
import { cn } from '@/lib/utils';

// Rough USD prices: for quote currencies we try to resolve via ticker data.
// If an asset has a <ASSET>USDT pair, its price in USD = lastPrice of that pair.
// USDT itself is 1:1 with USD.

interface AssetRow {
  currency: string;
  available: number;
  locked: number;
  total: number;
  usdPrice: number;
  usdValue: number;
}

export default function WalletPage() {
  const [balances, setBalances] = useState<BalanceDto[]>([]);
  const [pairs, setPairs] = useState<TradingPairDto[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showBalances, setShowBalances] = useState(true);
  const [search, setSearch] = useState('');
  const [hideSmall, setHideSmall] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [bal, pairList] = await Promise.all([
        walletApi.getBalances(),
        marketApi.getPairs().catch(() => [] as TradingPairDto[]),
      ]);
      setBalances(bal);
      setPairs(pairList);
      setError('');

      // Fetch ticker prices for all USDT pairs to estimate USD values
      const usdtPairs = pairList.filter((p) => p.quoteCurrency === 'USDT' && p.isActive);
      if (usdtPairs.length > 0) {
        const tickerResults = await Promise.allSettled(
          usdtPairs.map((p) => marketApi.getTicker(p.symbol)),
        );
        const priceMap: Record<string, number> = { USDT: 1 };
        tickerResults.forEach((result, i) => {
          const pair = usdtPairs[i];
          if (result.status === 'fulfilled' && result.value && pair) {
            priceMap[pair.baseCurrency] = parseFloat(result.value.lastPrice) || 0;
          }
        });
        setPrices(priceMap);
      } else {
        setPrices({ USDT: 1 });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load balances');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Live balance updates from WebSocket
  useAccountStream({
    onBalance(e) {
      setBalances(e.balances);
    },
  });

  // Build asset rows with USD values
  const assetRows: AssetRow[] = useMemo(() => {
    return balances.map((b) => {
      const available = parseFloat(b.available) || 0;
      const locked = parseFloat(b.locked) || 0;
      const total = parseFloat(b.total) || 0;
      const usdPrice = prices[b.currency] ?? 0;
      const usdValue = total * usdPrice;
      return {
        currency: b.currency,
        available,
        locked,
        total,
        usdPrice,
        usdValue,
      };
    });
  }, [balances, prices]);

  // Filtered and sorted
  const filtered = useMemo(() => {
    return assetRows
      .filter((a) => {
        if (search && !a.currency.toLowerCase().includes(search.toLowerCase())) return false;
        if (hideSmall && a.usdValue < 1) return false;
        return true;
      })
      .sort((a, b) => b.usdValue - a.usdValue);
  }, [assetRows, search, hideSmall]);

  // Total portfolio value in USDT
  const totalPortfolioUsd = useMemo(() => {
    return assetRows.reduce((sum, a) => sum + a.usdValue, 0);
  }, [assetRows]);

  const mask = (val: string) => (showBalances ? val : '****');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] bg-nvx-bg-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-nvx-primary border-t-transparent mx-auto mb-4" />
          <p className="text-nvx-text-secondary text-sm">Loading wallet...</p>
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
            <h1 className="text-xl font-bold text-nvx-text-primary">Wallet</h1>
            <p className="text-sm text-nvx-text-muted mt-1">Manage your assets</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBalances(!showBalances)}
              className="p-2 rounded-lg text-nvx-text-muted hover:text-nvx-text-primary hover:bg-nvx-bg-tertiary transition-colors"
              title={showBalances ? 'Hide balances' : 'Show balances'}
            >
              {showBalances ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
            <button
              onClick={loadData}
              className="p-2 rounded-lg text-nvx-text-muted hover:text-nvx-text-primary hover:bg-nvx-bg-tertiary transition-colors"
              title="Refresh"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        {/* Portfolio value card */}
        <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-5 mb-6">
          <p className="text-xs text-nvx-text-muted uppercase tracking-wider mb-1">
            Estimated Portfolio Value
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-nvx-text-primary font-mono">
            {mask(
              totalPortfolioUsd.toLocaleString(undefined, {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }),
            )}
          </p>
          <p className="text-xs text-nvx-text-muted mt-1">
            {mask(
              `${totalPortfolioUsd.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} USDT`,
            )}
          </p>
        </div>

        {error && (
          <div className="bg-nvx-sell/10 border border-nvx-sell/30 text-nvx-sell text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl overflow-hidden">
          <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 border-b border-nvx-border">
            <div className="relative flex-1 max-w-xs w-full">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-nvx-text-muted" />
              <input
                type="text"
                placeholder="Search assets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary placeholder-nvx-text-muted focus:outline-none focus:border-nvx-primary"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-nvx-text-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideSmall}
                onChange={(e) => setHideSmall(e.target.checked)}
                className="rounded border-nvx-border bg-nvx-bg-primary accent-nvx-primary"
              />
              Hide small balances (&lt; $1)
            </label>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-nvx-border text-nvx-text-muted text-xs">
                  <th className="text-left py-3 px-4 font-medium">Asset</th>
                  <th className="text-right py-3 px-4 font-medium">Available</th>
                  <th className="text-right py-3 px-4 font-medium">Locked</th>
                  <th className="text-right py-3 px-4 font-medium">Total</th>
                  <th className="text-right py-3 px-4 font-medium">USD Value</th>
                  <th className="text-right py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-nvx-text-muted text-sm">
                      {balances.length === 0
                        ? 'No wallet balances found. Trade to create wallets.'
                        : 'No assets match your filters.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((a) => (
                    <tr
                      key={a.currency}
                      className="border-b border-nvx-border/30 hover:bg-nvx-bg-tertiary/30 transition-colors"
                    >
                      {/* Asset */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-nvx-primary/20 flex items-center justify-center text-nvx-primary text-xs font-bold flex-shrink-0">
                            {a.currency.slice(0, 1)}
                          </div>
                          <div>
                            <span className="font-medium text-nvx-text-primary text-sm">
                              {a.currency}
                            </span>
                            {a.usdPrice > 0 && a.currency !== 'USDT' && (
                              <p className="text-[10px] text-nvx-text-muted font-mono">
                                ${a.usdPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Available */}
                      <td className="py-3 px-4 text-right font-mono text-sm text-nvx-text-primary">
                        {mask(formatBalance(a.available))}
                      </td>

                      {/* Locked */}
                      <td className="py-3 px-4 text-right font-mono text-sm text-nvx-text-secondary">
                        {mask(formatBalance(a.locked))}
                      </td>

                      {/* Total */}
                      <td className="py-3 px-4 text-right font-mono text-sm text-nvx-text-primary font-medium">
                        {mask(formatBalance(a.total))}
                      </td>

                      {/* USD Value */}
                      <td className="py-3 px-4 text-right font-mono text-sm text-nvx-text-secondary">
                        {mask(
                          a.usdValue > 0
                            ? `$${a.usdValue.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`
                            : '--',
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href="/wallet/deposit"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-nvx-primary bg-nvx-primary/10 rounded hover:bg-nvx-primary/20 transition-colors"
                          >
                            <ArrowDownToLine size={12} />
                            <span className="hidden sm:inline">Deposit</span>
                          </Link>
                          <Link
                            href="/wallet/withdraw"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-nvx-text-secondary bg-nvx-bg-tertiary rounded hover:bg-nvx-bg-tertiary/80 transition-colors"
                          >
                            <ArrowUpFromLine size={12} />
                            <span className="hidden sm:inline">Withdraw</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatBalance(val: number): string {
  if (val === 0) return '0';
  if (val >= 1) return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
  return val.toFixed(8);
}
