/**
 * Chrome storage wrapper for NovEx extension.
 * Uses chrome.storage.local for cached data and chrome.storage.sync for settings.
 */

export interface NovExSettings {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  notificationsEnabled: boolean;
  priceCheckIntervalMinutes: number;
  currency: "USD" | "EUR" | "GBP";
}

export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  direction: "above" | "below";
  createdAt: number;
  triggered: boolean;
}

export interface CachedPortfolio {
  balances: Array<{
    asset: string;
    free: string;
    locked: string;
    usdValue: string;
  }>;
  totalUsdValue: string;
  lastUpdated: number;
}

const DEFAULT_SETTINGS: NovExSettings = {
  apiKey: "",
  apiSecret: "",
  baseUrl: "https://api.novex.io",
  notificationsEnabled: true,
  priceCheckIntervalMinutes: 1,
  currency: "USD",
};

function getStorage(): typeof chrome.storage | null {
  if (typeof chrome !== "undefined" && chrome.storage) {
    return chrome.storage;
  }
  return null;
}

export const storage = {
  async getSettings(): Promise<NovExSettings> {
    const store = getStorage();
    if (!store) return DEFAULT_SETTINGS;
    const result = await store.sync.get("settings");
    return { ...DEFAULT_SETTINGS, ...(result.settings ?? {}) };
  },

  async saveSettings(settings: Partial<NovExSettings>): Promise<void> {
    const store = getStorage();
    if (!store) return;
    const current = await this.getSettings();
    await store.sync.set({ settings: { ...current, ...settings } });
  },

  async getAlerts(): Promise<PriceAlert[]> {
    const store = getStorage();
    if (!store) return [];
    const result = await store.local.get("priceAlerts");
    return result.priceAlerts ?? [];
  },

  async saveAlerts(alerts: PriceAlert[]): Promise<void> {
    const store = getStorage();
    if (!store) return;
    await store.local.set({ priceAlerts: alerts });
  },

  async addAlert(
    alert: Omit<PriceAlert, "id" | "createdAt" | "triggered">
  ): Promise<PriceAlert> {
    const newAlert: PriceAlert = {
      ...alert,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      triggered: false,
    };
    const alerts = await this.getAlerts();
    alerts.push(newAlert);
    await this.saveAlerts(alerts);
    return newAlert;
  },

  async removeAlert(id: string): Promise<void> {
    const alerts = await this.getAlerts();
    await this.saveAlerts(alerts.filter((a) => a.id !== id));
  },

  async getCachedPortfolio(): Promise<CachedPortfolio | null> {
    const store = getStorage();
    if (!store) return null;
    const result = await store.local.get("cachedPortfolio");
    return result.cachedPortfolio ?? null;
  },

  async cachePortfolio(portfolio: CachedPortfolio): Promise<void> {
    const store = getStorage();
    if (!store) return;
    await store.local.set({ cachedPortfolio: portfolio });
  },

  async getPriceCache(): Promise<Record<string, number>> {
    const store = getStorage();
    if (!store) return {};
    const result = await store.local.get("priceCache");
    return result.priceCache ?? {};
  },

  async setPriceCache(prices: Record<string, number>): Promise<void> {
    const store = getStorage();
    if (!store) return;
    await store.local.set({ priceCache: prices });
  },
};
