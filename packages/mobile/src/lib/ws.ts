import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/auth.store';
import { useMarketStore } from '../stores/market.store';
import { toApiSymbol } from './api';
import type { Ticker, OrderBook } from '../types';

const WS_BASE_URL =
  process.env.EXPO_PUBLIC_WS_URL ?? 'http://10.0.2.2:3000';

class WebSocketClient {
  private socket: Socket | null = null;
  private subscribedSymbols = new Map<string, Set<string>>(); // symbol -> Set<channel>
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;

  connect(): void {
    if (this.socket?.connected) return;

    const token = useAuthStore.getState().getAccessToken();

    this.socket = io(`${WS_BASE_URL}/ws/market`, {
      transports: ['websocket'],
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
      // Re-subscribe to previously subscribed channels
      for (const [symbol, channels] of this.subscribedSymbols) {
        this.socket?.emit('subscribe', { symbol, channels: Array.from(channels) });
      }
    });

    this.socket.on('disconnect', () => {
      this.reconnectAttempts++;
    });

    // ── Ticker updates ──────────────────────────────────
    this.socket.on('ticker:update', (data: {
      symbol: string;
      lastPrice: string;
      seq: number;
      timestamp: number;
    }) => {
      // Convert to our Ticker shape
      useMarketStore.getState().updateTicker({
        symbol: data.symbol,
        price: data.lastPrice,
        change24h: '', // ticker:update only has lastPrice; full ticker from REST
        volume24h: '',
      });
    });

    // ── Orderbook snapshots & updates ───────────────────
    this.socket.on('orderbook:snapshot', (data: {
      symbol: string;
      bids: [string, string][];
      asks: [string, string][];
      seq: number;
      timestamp: number;
    }) => {
      this.handleOrderBookData(data);
    });

    this.socket.on('orderbook:update', (data: {
      symbol: string;
      bids: [string, string][];
      asks: [string, string][];
      seq: number;
      timestamp: number;
    }) => {
      this.handleOrderBookData(data);
    });

    // ── Trade stream ────────────────────────────────────
    this.socket.on('trade', (data: {
      symbol: string;
      price: string;
      quantity: string;
      takerSide: string;
      seq: number;
      timestamp: number;
    }) => {
      // Could dispatch to a trades store if needed
    });
  }

  private handleOrderBookData(data: {
    symbol: string;
    bids: [string, string][];
    asks: [string, string][];
    timestamp: number;
  }): void {
    const { selectedSymbol } = useMarketStore.getState();
    // WS sends API format (BTC_USDT), store uses display format (BTC/USDT)
    if (data.symbol === toApiSymbol(selectedSymbol)) {
      let bidTotal = 0;
      let askTotal = 0;
      useMarketStore.getState().updateOrderBook({
        bids: data.bids.map(([price, amount]) => {
          bidTotal += parseFloat(amount);
          return { price, amount, total: bidTotal.toFixed(8) };
        }),
        asks: data.asks.map(([price, amount]) => {
          askTotal += parseFloat(amount);
          return { price, amount, total: askTotal.toFixed(8) };
        }),
        lastUpdated: data.timestamp,
      });
    }
  }

  subscribeTicker(symbol: string): void {
    this.addSubscription(symbol, 'ticker');
  }

  unsubscribeTicker(symbol: string): void {
    this.removeSubscription(symbol, 'ticker');
  }

  subscribeOrderBook(symbol: string): void {
    this.addSubscription(symbol, 'orderbook');
  }

  unsubscribeOrderBook(symbol: string): void {
    this.removeSubscription(symbol, 'orderbook');
  }

  subscribeTrades(symbol: string): void {
    this.addSubscription(symbol, 'trades');
  }

  unsubscribeTrades(symbol: string): void {
    this.removeSubscription(symbol, 'trades');
  }

  subscribeAllTickers(symbols: string[]): void {
    for (const symbol of symbols) {
      this.addSubscription(symbol, 'ticker');
    }
  }

  private addSubscription(symbol: string, channel: string): void {
    if (!this.subscribedSymbols.has(symbol)) {
      this.subscribedSymbols.set(symbol, new Set());
    }
    this.subscribedSymbols.get(symbol)!.add(channel);
    this.socket?.emit('subscribe', { symbol, channels: [channel] });
  }

  private removeSubscription(symbol: string, channel: string): void {
    this.subscribedSymbols.get(symbol)?.delete(channel);
    if (this.subscribedSymbols.get(symbol)?.size === 0) {
      this.subscribedSymbols.delete(symbol);
    }
    this.socket?.emit('unsubscribe', { symbol, channels: [channel] });
  }

  disconnect(): void {
    this.subscribedSymbols.clear();
    this.socket?.disconnect();
    this.socket = null;
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const wsClient = new WebSocketClient();
export default wsClient;
