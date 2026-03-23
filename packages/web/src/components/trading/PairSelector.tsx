'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, Star, ChevronDown, X } from 'lucide-react';
import { type TradingPairDto } from '@/lib/api';
import { cn } from '@/lib/utils';

const FAVORITES_KEY = 'novex_favorite_pairs';

interface TickerInfo {
  lastPrice: string;
  priceChangePercent24h: string;
}

interface PairSelectorProps {
  pairs: TradingPairDto[];
  selectedPair: string;
  tickers: Record<string, TickerInfo>;
  onSelectPair: (symbol: string) => void;
}

function loadFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveFavorites(favorites: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

export function PairSelector({ pairs, selectedPair, tickers, onSelectPair }: PairSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load favorites on mount
  useEffect(() => {
    setFavorites(loadFavorites());
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const toggleFavorite = useCallback((symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol];
      saveFavorites(next);
      return next;
    });
  }, []);

  const handleSelect = useCallback((symbol: string) => {
    onSelectPair(symbol);
    setIsOpen(false);
    setSearch('');
  }, [onSelectPair]);

  const filteredPairs = useMemo(() => {
    const query = search.toLowerCase().trim();
    const filtered = query
      ? pairs.filter((p) =>
          p.symbol.toLowerCase().includes(query) ||
          p.baseCurrency.toLowerCase().includes(query) ||
          p.quoteCurrency.toLowerCase().includes(query)
        )
      : pairs;

    // Sort: favorites first, then alphabetical
    return [...filtered].sort((a, b) => {
      const aFav = favorites.includes(a.symbol) ? 0 : 1;
      const bFav = favorites.includes(b.symbol) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      return a.symbol.localeCompare(b.symbol);
    });
  }, [pairs, search, favorites]);

  const currentPair = pairs.find((p) => p.symbol === selectedPair);
  const currentTicker = tickers[selectedPair];
  const displayLabel = currentPair
    ? `${currentPair.baseCurrency}/${currentPair.quoteCurrency}`
    : selectedPair.replace(/USDT$/, '/USDT');

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-nvx-bg-tertiary border border-nvx-border rounded px-3 py-1.5 text-sm font-semibold text-nvx-text-primary hover:border-nvx-primary transition-colors focus:outline-none focus:border-nvx-primary"
      >
        <span>{displayLabel}</span>
        {currentTicker && (
          <span
            className={cn(
              'text-xs font-normal',
              parseFloat(currentTicker.priceChangePercent24h) >= 0
                ? 'text-nvx-buy'
                : 'text-nvx-sell',
            )}
          >
            {parseFloat(currentTicker.priceChangePercent24h) >= 0 ? '+' : ''}
            {parseFloat(currentTicker.priceChangePercent24h).toFixed(2)}%
          </span>
        )}
        <ChevronDown
          size={14}
          className={cn(
            'text-nvx-text-muted transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-[380px] bg-nvx-bg-secondary border border-nvx-border rounded-lg shadow-2xl shadow-black/50 z-50 animate-fade-in overflow-hidden">
          {/* Search header */}
          <div className="p-3 border-b border-nvx-border">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-nvx-text-muted"
              />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search pairs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 bg-nvx-bg-primary border border-nvx-border rounded text-sm text-nvx-text-primary placeholder-nvx-text-muted focus:outline-none focus:border-nvx-primary"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-nvx-text-muted hover:text-nvx-text-primary"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[28px_1fr_100px_90px] gap-2 px-3 py-2 text-[10px] text-nvx-text-muted uppercase tracking-wider border-b border-nvx-border/50">
            <span />
            <span>Pair</span>
            <span className="text-right">Price</span>
            <span className="text-right">24h %</span>
          </div>

          {/* Pairs list */}
          <div className="max-h-[320px] overflow-y-auto">
            {filteredPairs.length === 0 ? (
              <div className="py-8 text-center text-nvx-text-muted text-sm">
                No pairs found
              </div>
            ) : (
              filteredPairs.map((pair) => {
                const t = tickers[pair.symbol];
                const isFav = favorites.includes(pair.symbol);
                const isSelected = pair.symbol === selectedPair;
                const changeNum = t ? parseFloat(t.priceChangePercent24h) : 0;

                return (
                  <button
                    key={pair.symbol}
                    onClick={() => handleSelect(pair.symbol)}
                    className={cn(
                      'w-full grid grid-cols-[28px_1fr_100px_90px] gap-2 items-center px-3 py-2 text-sm transition-colors',
                      isSelected
                        ? 'bg-nvx-primary/10'
                        : 'hover:bg-nvx-bg-tertiary/60',
                    )}
                  >
                    {/* Star */}
                    <span
                      onClick={(e) => toggleFavorite(pair.symbol, e)}
                      className={cn(
                        'flex items-center justify-center cursor-pointer',
                        isFav
                          ? 'text-nvx-warning'
                          : 'text-nvx-text-muted/40 hover:text-nvx-warning/60',
                      )}
                    >
                      <Star size={14} fill={isFav ? 'currentColor' : 'none'} />
                    </span>

                    {/* Symbol */}
                    <span className="text-left">
                      <span className="text-nvx-text-primary font-medium">
                        {pair.baseCurrency}
                      </span>
                      <span className="text-nvx-text-muted">
                        /{pair.quoteCurrency}
                      </span>
                    </span>

                    {/* Last price */}
                    <span className="text-right font-mono text-nvx-text-primary text-xs">
                      {t
                        ? parseFloat(t.lastPrice).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })
                        : '--'}
                    </span>

                    {/* 24h change */}
                    <span
                      className={cn(
                        'text-right font-mono text-xs',
                        t
                          ? changeNum >= 0
                            ? 'text-nvx-buy'
                            : 'text-nvx-sell'
                          : 'text-nvx-text-muted',
                      )}
                    >
                      {t
                        ? `${changeNum >= 0 ? '+' : ''}${changeNum.toFixed(2)}%`
                        : '--'}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
