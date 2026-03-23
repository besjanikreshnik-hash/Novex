import { create } from "zustand";
import type {
  OrderBook,
  Trade,
  Ticker,
  TradingPair,
  TimeFrame,
  OrderSide,
  OrderType,
} from "@/types";

interface TradingState {
  // Selected trading pair
  selectedPair: string;
  pairInfo: TradingPair | null;
  ticker: Ticker | null;

  // Order book
  orderBook: OrderBook;

  // Recent trades
  recentTrades: Trade[];

  // Order form
  orderSide: OrderSide;
  orderType: OrderType;
  orderPrice: string;
  orderAmount: string;

  // Chart
  timeFrame: TimeFrame;

  // Actions
  setSelectedPair: (pair: string) => void;
  setPairInfo: (info: TradingPair) => void;
  setTicker: (ticker: Ticker) => void;
  setOrderBook: (orderBook: OrderBook) => void;
  addRecentTrade: (trade: Trade) => void;
  setRecentTrades: (trades: Trade[]) => void;
  setOrderSide: (side: OrderSide) => void;
  setOrderType: (type: OrderType) => void;
  setOrderPrice: (price: string) => void;
  setOrderAmount: (amount: string) => void;
  setTimeFrame: (tf: TimeFrame) => void;
}

export const useTradingStore = create<TradingState>()((set) => ({
  selectedPair: "BTC/USDT",
  pairInfo: null,
  ticker: null,

  orderBook: {
    bids: [],
    asks: [],
    lastUpdateId: 0,
    timestamp: Date.now(),
  },

  recentTrades: [],

  orderSide: "buy",
  orderType: "limit",
  orderPrice: "",
  orderAmount: "",

  timeFrame: "1h",

  setSelectedPair: (selectedPair) => set({ selectedPair }),
  setPairInfo: (pairInfo) => set({ pairInfo }),
  setTicker: (ticker) => set({ ticker }),
  setOrderBook: (orderBook) => set({ orderBook }),
  addRecentTrade: (trade) =>
    set((state) => ({
      recentTrades: [trade, ...state.recentTrades].slice(0, 100),
    })),
  setRecentTrades: (recentTrades) => set({ recentTrades }),
  setOrderSide: (orderSide) => set({ orderSide }),
  setOrderType: (orderType) => set({ orderType }),
  setOrderPrice: (orderPrice) => set({ orderPrice }),
  setOrderAmount: (orderAmount) => set({ orderAmount }),
  setTimeFrame: (timeFrame) => set({ timeFrame }),
}));
