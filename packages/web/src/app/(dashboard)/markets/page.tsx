'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Search, ArrowUpDown, TrendingUp, TrendingDown } from 'lucide-react';
import { marketApi, type TradingPairDto, type TickerDto } from '@/lib/api';
import { cn } from '@/lib/utils';

type SortField = 'name' | 'price' | 'change' | 'volume';
type SortDir = 'asc' | 'desc';

interface PairRow {
  pair: TradingPairDto;
  ticker: TickerDto | null;
}

export default function MarketsPage() {
  const [rows, setRows] = useState<PairRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    async function load() {
      try {
        const pairs = await marketApi.getPairs();
        // Fetch tickers for every pair
        const tickerResults = await Promise.allSettled(
          pairs.map((p) => marketApi.getTicker(p.symbol)),
        );
        const data: PairRow[] = pairs.map((pair, i) => ({
          pair,
          ticker:
            tickerResults[i]?.status === 'fulfilled'
              ? (tickerResults[i] as PromiseFulfilledResult<TickerDto>).value
              : null,
        }));
        setRows(data);
      } catch {
        // partial failure is acceptable
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Toggle sort or change field
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
  };

  const filtered = useMemo(() => {
    const q = search.toUpperCase().trim();
    let list = rows;
    if (q) {
      list = rows.filter(
        (r) =>
          r.pair.symbol.includes(q) ||
          r.pair.baseCurrency.includes(q) ||
          r.pair.quoteCurrency.includes(q),
      );
    }

    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.pair.symbol.localeCompare(b.pair.symbol);
          break;
        case 'price': {
          const pa = parseFloat(a.ticker?.lastPrice ?? '0');
          const pb = parseFloat(b.ticker?.lastPrice ?? '0');
          cmp = pa - pb;
          break;
        }
        case 'change': {
          const ca = parseFloat(a.ticker?.priceChangePercent24h ?? '0');
          const cb = parseFloat(b.ticker?.priceChangePercent24h ?? '0');
          cmp = ca - cb;
          break;
        }
        case 'volume': {
          const va = parseFloat(a.ticker?.volume24h ?? '0');
          const vb = parseFloat(b.ticker?.volume24h ?? '0');
          cmp = va - vb;
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [rows, search, sortField, sortDir]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] bg-nvx-bg-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-nvx-primary border-t-transparent mx-auto mb-4" />
          <p className="text-nvx-text-secondary">Loading markets...</p>
        </div>
      </div>
    );
  }

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className={cn(
        'flex items-center gap-1 text-xs font-medium transition-colors',
        sortField === field ? 'text-nvx-primary' : 'text-nvx-text-muted hover:text-nvx-text-secondary',
      )}
    >
      {label}
      <ArrowUpDown size={12} />
    </button>
  );

  return (
    <div className="min-h-[calc(100vh-56px)] bg-nvx-bg-primary">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-nvx-text-primary mb-1">Markets</h1>
        <p className="text-sm text-nvx-text-muted mb-6">
          Browse all available trading pairs on NovEx
        </p>

        {/* Search */}
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-nvx-text-muted" />
          <input
            type="text"
            placeholder="Search pairs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-nvx-bg-secondary border border-nvx-border rounded-lg text-sm text-nvx-text-primary placeholder:text-nvx-text-muted focus:outline-none focus:border-nvx-primary transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      <div className="max-w-6xl mx-auto px-4 pb-8">
        <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-nvx-border">
                <th className="text-left px-4 py-3">
                  <SortButton field="name" label="Pair" />
                </th>
                <th className="text-right px-4 py-3">
                  <div className="flex justify-end">
                    <SortButton field="price" label="Last Price" />
                  </div>
                </th>
                <th className="text-right px-4 py-3">
                  <div className="flex justify-end">
                    <SortButton field="change" label="24h Change" />
                  </div>
                </th>
                <th className="text-right px-4 py-3">
                  <div className="flex justify-end">
                    <SortButton field="volume" label="24h Volume" />
                  </div>
                </th>
                <th className="text-right px-4 py-3">
                  <span className="text-xs font-medium text-nvx-text-muted">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-nvx-text-muted">
                    No pairs found
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const change = parseFloat(row.ticker?.priceChangePercent24h ?? '0');
                  const isPositive = change >= 0;
                  const price = parseFloat(row.ticker?.lastPrice ?? '0');
                  const volume = parseFloat(row.ticker?.volume24h ?? '0');

                  return (
                    <tr
                      key={row.pair.id}
                      className="border-b border-nvx-border/50 hover:bg-nvx-bg-tertiary/50 transition-colors"
                    >
                      {/* Pair */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-nvx-text-primary">
                            {row.pair.baseCurrency}
                          </span>
                          <span className="text-nvx-text-muted">/</span>
                          <span className="text-nvx-text-muted">
                            {row.pair.quoteCurrency}
                          </span>
                        </div>
                      </td>

                      {/* Last Price */}
                      <td className="px-4 py-3 text-right font-mono text-nvx-text-primary">
                        {price > 0
                          ? price.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: row.pair.pricePrecision,
                            })
                          : '--'}
                      </td>

                      {/* 24h Change */}
                      <td className="px-4 py-3 text-right">
                        {row.ticker ? (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 font-medium',
                              isPositive ? 'text-nvx-buy' : 'text-nvx-sell',
                            )}
                          >
                            {isPositive ? (
                              <TrendingUp size={14} />
                            ) : (
                              <TrendingDown size={14} />
                            )}
                            {isPositive ? '+' : ''}
                            {change.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-nvx-text-muted">--</span>
                        )}
                      </td>

                      {/* 24h Volume */}
                      <td className="px-4 py-3 text-right font-mono text-nvx-text-secondary">
                        {volume > 0
                          ? volume.toLocaleString(undefined, {
                              maximumFractionDigits: 0,
                            })
                          : '--'}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/trade?pair=${row.pair.symbol}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-nvx-primary bg-nvx-primary/10 hover:bg-nvx-primary/20 rounded-lg transition-colors"
                        >
                          Trade
                        </Link>
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
  );
}
