import { create } from "zustand";
import type { PriceAlert, CachedPortfolio, NovExSettings } from "@/lib/storage";
import { storage } from "@/lib/storage";
import { api } from "@/lib/api";
import Decimal from "decimal.js";

type Tab = "portfolio" | "trade" | "alerts" | "settings";

interface PopupState {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;

  // Portfolio
  portfolio: CachedPortfolio | null;
  portfolioLoading: boolean;
  portfolioError: string | null;
  loadPortfolio: () => Promise<void>;

  // Trade
  tradeSymbol: string;
  tradeSide: "BUY" | "SELL";
  tradeAmount: string;
  tradeLoading: boolean;
  tradeError: string | null;
  tradeSuccess: string | null;
  setTradeSymbol: (s: string) => void;
  setTradeSide: (s: "BUY" | "SELL") => void;
  setTradeAmount: (a: string) => void;
  submitTrade: () => Promise<void>;

  // Alerts
  alerts: PriceAlert[];
  alertsLoading: boolean;
  loadAlerts: () => Promise<void>;
  addAlert: (symbol: string, price: number, direction: "above" | "below") => Promise<void>;
  removeAlert: (id: string) => Promise<void>;

  // Settings
  settings: NovExSettings | null;
  settingsLoading: boolean;
  settingsSaved: boolean;
  loadSettings: () => Promise<void>;
  saveSettings: (s: Partial<NovExSettings>) => Promise<void>;

  // Prices
  prices: Record<string, number>;
  loadPrices: () => Promise<void>;
}

export const usePopupStore = create<PopupState>((set, get) => ({
  activeTab: "portfolio",
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Portfolio
  portfolio: null,
  portfolioLoading: false,
  portfolioError: null,

  async loadPortfolio() {
    set({ portfolioLoading: true, portfolioError: null });

    // Load cached first
    const cached = await storage.getCachedPortfolio();
    if (cached) set({ portfolio: cached });

    const result = await api.getBalances();
    if (!result.success) {
      set({ portfolioLoading: false, portfolioError: result.error ?? "Failed to load" });
      return;
    }

    const prices = get().prices;
    const balances = result.data.map((b) => {
      const price = prices[`${b.asset}USDT`] ?? 0;
      const total = new Decimal(b.free).plus(b.locked);
      const usdValue = total.mul(price);
      return {
        asset: b.asset,
        free: b.free,
        locked: b.locked,
        usdValue: usdValue.toFixed(2),
      };
    });

    const totalUsdValue = balances
      .reduce((acc, b) => acc.plus(b.usdValue), new Decimal(0))
      .toFixed(2);

    const portfolio: CachedPortfolio = {
      balances,
      totalUsdValue,
      lastUpdated: Date.now(),
    };

    await storage.cachePortfolio(portfolio);
    set({ portfolio, portfolioLoading: false });
  },

  // Trade
  tradeSymbol: "BTCUSDT",
  tradeSide: "BUY",
  tradeAmount: "",
  tradeLoading: false,
  tradeError: null,
  tradeSuccess: null,
  setTradeSymbol: (s) => set({ tradeSymbol: s, tradeError: null, tradeSuccess: null }),
  setTradeSide: (s) => set({ tradeSide: s, tradeError: null, tradeSuccess: null }),
  setTradeAmount: (a) => set({ tradeAmount: a, tradeError: null, tradeSuccess: null }),

  async submitTrade() {
    const { tradeSymbol, tradeSide, tradeAmount } = get();
    if (!tradeAmount || new Decimal(tradeAmount).lte(0)) {
      set({ tradeError: "Enter a valid amount" });
      return;
    }

    set({ tradeLoading: true, tradeError: null, tradeSuccess: null });
    const result = await api.placeOrder({
      symbol: tradeSymbol,
      side: tradeSide,
      type: "MARKET",
      quantity: tradeAmount,
    });

    if (result.success) {
      set({
        tradeLoading: false,
        tradeSuccess: `Order placed: ${tradeSide} ${tradeAmount} ${tradeSymbol}`,
        tradeAmount: "",
      });
    } else {
      set({ tradeLoading: false, tradeError: result.error ?? "Trade failed" });
    }
  },

  // Alerts
  alerts: [],
  alertsLoading: false,

  async loadAlerts() {
    set({ alertsLoading: true });
    const alerts = await storage.getAlerts();
    set({ alerts, alertsLoading: false });
  },

  async addAlert(symbol, price, direction) {
    await storage.addAlert({ symbol, targetPrice: price, direction });
    await get().loadAlerts();
  },

  async removeAlert(id) {
    await storage.removeAlert(id);
    await get().loadAlerts();
  },

  // Settings
  settings: null,
  settingsLoading: false,
  settingsSaved: false,

  async loadSettings() {
    set({ settingsLoading: true });
    const settings = await storage.getSettings();
    set({ settings, settingsLoading: false });
  },

  async saveSettings(partial) {
    await storage.saveSettings(partial);
    const settings = await storage.getSettings();
    set({ settings, settingsSaved: true });
    setTimeout(() => set({ settingsSaved: false }), 2000);
  },

  // Prices
  prices: {},

  async loadPrices() {
    const cached = await storage.getPriceCache();
    if (Object.keys(cached).length) set({ prices: cached });

    const result = await api.getTickers();
    if (result.success) {
      const prices: Record<string, number> = {};
      for (const t of result.data) {
        prices[t.symbol] = parseFloat(t.price);
      }
      set({ prices });
      await storage.setPriceCache(prices);
    }
  },
}));
