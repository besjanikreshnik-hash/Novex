import { create } from 'zustand';
import { toDisplaySymbol } from '../lib/api';
import type { TradingPair, OrderBook, Ticker } from '../types';

interface MarketState {
  pairs: TradingPair[];
  selectedSymbol: string;
  orderBook: OrderBook | null;
  tickers: Record<string, Ticker>;
  searchQuery: string;

  setPairs: (pairs: TradingPair[]) => void;
  setSelectedSymbol: (symbol: string) => void;
  updateTicker: (ticker: Ticker) => void;
  updateOrderBook: (orderBook: OrderBook) => void;
  setSearchQuery: (query: string) => void;
  getFilteredPairs: () => TradingPair[];
}

export const useMarketStore = create<MarketState>((set, get) => ({
  pairs: [],
  selectedSymbol: 'BTC/USDT',
  orderBook: null,
  tickers: {},
  searchQuery: '',

  setPairs: (pairs) => set({ pairs }),

  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol, orderBook: null }),

  updateTicker: (ticker) =>
    set((state) => {
      // WS sends API symbol format (BTC_USDT), convert to display format (BTC/USDT)
      const displaySymbol = ticker.symbol.includes('_')
        ? toDisplaySymbol(ticker.symbol)
        : ticker.symbol;

      const updatedTicker = { ...ticker, symbol: displaySymbol };

      return {
        tickers: { ...state.tickers, [displaySymbol]: updatedTicker },
        pairs: state.pairs.map((p) => {
          if (p.symbol !== displaySymbol) return p;
          return {
            ...p,
            // Only update fields that have real values (WS ticker:update only has price)
            lastPrice: ticker.price || p.lastPrice,
            change24h: ticker.change24h || p.change24h,
            volume24h: ticker.volume24h || p.volume24h,
          };
        }),
      };
    }),

  updateOrderBook: (orderBook) => set({ orderBook }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  getFilteredPairs: () => {
    const { pairs, searchQuery } = get();
    if (!searchQuery.trim()) return pairs;
    const q = searchQuery.toUpperCase();
    return pairs.filter(
      (p) => p.symbol.includes(q) || p.baseAsset.includes(q) || p.quoteAsset.includes(q),
    );
  },
}));
