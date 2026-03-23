/**
 * NovEx API client.
 * Uses stored API credentials from chrome.storage.
 */

import { storage } from "./storage";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

interface Ticker {
  symbol: string;
  price: string;
  change24h: string;
  volume24h: string;
}

interface Balance {
  asset: string;
  free: string;
  locked: string;
}

interface OrderResult {
  orderId: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  quantity: string;
  price: string;
  status: string;
}

class NovExApiClient {
  private async getHeaders(): Promise<Record<string, string>> {
    const settings = await storage.getSettings();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (settings.apiKey) {
      headers["X-NovEx-Key"] = settings.apiKey;
    }
    return headers;
  }

  private async getBaseUrl(): Promise<string> {
    const settings = await storage.getSettings();
    return settings.baseUrl;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<ApiResponse<T>> {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getHeaders();

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return {
          success: false,
          data: null as T,
          error:
            (error as { message?: string }).message ??
            `HTTP ${response.status}`,
        };
      }

      const data = await response.json();
      return { success: true, data: data as T };
    } catch (err) {
      return {
        success: false,
        data: null as T,
        error: err instanceof Error ? err.message : "Network error",
      };
    }
  }

  async getTickers(symbols?: string[]): Promise<ApiResponse<Ticker[]>> {
    const query = symbols ? `?symbols=${symbols.join(",")}` : "";
    return this.request<Ticker[]>("GET", `/v1/market/tickers${query}`);
  }

  async getPrice(symbol: string): Promise<ApiResponse<{ price: string }>> {
    return this.request<{ price: string }>(
      "GET",
      `/v1/market/price?symbol=${symbol}`
    );
  }

  async getBalances(): Promise<ApiResponse<Balance[]>> {
    return this.request<Balance[]>("GET", "/v1/account/balances");
  }

  async placeOrder(params: {
    symbol: string;
    side: "BUY" | "SELL";
    type: "MARKET" | "LIMIT";
    quantity: string;
    price?: string;
  }): Promise<ApiResponse<OrderResult>> {
    return this.request<OrderResult>("POST", "/v1/order", params);
  }

  async testConnection(): Promise<ApiResponse<{ status: string }>> {
    return this.request<{ status: string }>("GET", "/v1/ping");
  }
}

export const api = new NovExApiClient();
