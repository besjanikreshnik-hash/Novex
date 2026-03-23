'use client';

import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3000';

/* ─── Typed event payloads ─────────────────────────────── */

export interface WsTradeEvent {
  symbol: string;
  price: string;
  quantity: string;
  takerSide: string;
  seq: number;
  timestamp: number;
}

export interface WsTickerEvent {
  symbol: string;
  lastPrice: string;
  seq: number;
  timestamp: number;
}

export interface WsOrderBookEvent {
  symbol: string;
  bids: [string, string][];
  asks: [string, string][];
  seq: number;
  timestamp: number;
}

export interface WsOrderEvent {
  type: 'placed' | 'cancelled';
  order: any;
  seq: number;
  timestamp: number;
}

export interface WsFillEvent {
  type: 'fill';
  symbol: string;
  price: string;
  quantity: string;
  role: 'maker' | 'taker';
  orderId: string;
  seq: number;
  timestamp: number;
}

export interface WsBalanceEvent {
  type: 'balance_update';
  balances: Array<{ currency: string; available: string; locked: string; total: string }>;
  seq: number;
  timestamp: number;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

type EventHandler = (...args: any[]) => void;

interface ChannelSubscription {
  symbol: string;
  channels: string[];
}

/* ─── Client ───────────────────────────────────────────── */

class NovExWebSocket {
  private socket: Socket | null = null;
  private _state: ConnectionState = 'disconnected';
  private readonly stateListeners = new Set<(state: ConnectionState) => void>();
  private readonly eventHandlers = new Map<string, Set<EventHandler>>();
  private readonly activeChannels: ChannelSubscription[] = [];

  /** Per-room last seen sequence number for dedup */
  private readonly lastSeq = new Map<string, number>();

  get state(): ConnectionState {
    return this._state;
  }

  /* ─── Connection ───────────────────────────────────── */

  connect(): void {
    if (this.socket?.connected) return;
    this.disconnect(); // clean up any stale socket

    const token = getAccessToken();

    this.setState('connecting');

    this.socket = io(`${WS_URL}/ws/market`, {
      auth: token ? { token } : undefined,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
      randomizationFactor: 0.5,
    });

    this.socket.on('connect', () => {
      this.setState('connected');
      // Re-subscribe to all channels
      this.resubscribeAll();
      // Re-authenticate if token available
      const freshToken = getAccessToken();
      if (freshToken) {
        this.socket?.emit('authenticate', { token: freshToken });
      }
    });

    this.socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        this.setState('disconnected');
      } else {
        this.setState('reconnecting');
      }
    });

    this.socket.on('reconnect_attempt', () => {
      this.setState('reconnecting');
    });

    this.socket.on('reconnect_failed', () => {
      this.setState('disconnected');
    });

    this.socket.on('connect_error', () => {
      if (this._state !== 'reconnecting') {
        this.setState('reconnecting');
      }
    });

    // Re-attach all registered event handlers
    for (const [event, handlers] of this.eventHandlers) {
      for (const handler of handlers) {
        this.socket.on(event, handler);
      }
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.setState('disconnected');
  }

  /* ─── Event handling ───────────────────────────────── */

  on(event: string, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    if (this.socket) {
      this.socket.on(event, handler);
    }

    return () => this.off(event, handler);
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) this.eventHandlers.delete(event);
    }
    this.socket?.off(event, handler);
  }

  emit(event: string, data: any): void {
    this.socket?.emit(event, data);
  }

  /* ─── Channel subscriptions ────────────────────────── */

  subscribe(symbol: string, channels: string[]): void {
    // Track for reconnect
    const existing = this.activeChannels.find((c) => c.symbol === symbol);
    if (existing) {
      for (const ch of channels) {
        if (!existing.channels.includes(ch)) existing.channels.push(ch);
      }
    } else {
      this.activeChannels.push({ symbol, channels: [...channels] });
    }

    this.socket?.emit('subscribe', { symbol, channels });
  }

  unsubscribe(symbol: string, channels: string[]): void {
    const existing = this.activeChannels.find((c) => c.symbol === symbol);
    if (existing) {
      existing.channels = existing.channels.filter((ch) => !channels.includes(ch));
      if (existing.channels.length === 0) {
        const idx = this.activeChannels.indexOf(existing);
        this.activeChannels.splice(idx, 1);
      }
    }

    this.socket?.emit('unsubscribe', { symbol, channels });
  }

  unsubscribeAll(): void {
    for (const sub of [...this.activeChannels]) {
      this.socket?.emit('unsubscribe', { symbol: sub.symbol, channels: sub.channels });
    }
    this.activeChannels.length = 0;
    this.lastSeq.clear();
  }

  private resubscribeAll(): void {
    for (const sub of this.activeChannels) {
      this.socket?.emit('subscribe', { symbol: sub.symbol, channels: sub.channels });
    }
  }

  /* ─── Sequence dedup ───────────────────────────────── */

  /**
   * Check if an event should be applied based on its sequence number.
   * Returns true if the event is new (seq > lastSeen for this room).
   */
  shouldApply(room: string, seq: number): boolean {
    const last = this.lastSeq.get(room) ?? 0;
    if (seq <= last) return false; // duplicate or stale
    this.lastSeq.set(room, seq);
    return true;
  }

  /** Reset sequence tracking (call on symbol change) */
  resetSeq(roomPrefix?: string): void {
    if (roomPrefix) {
      for (const key of this.lastSeq.keys()) {
        if (key.startsWith(roomPrefix)) this.lastSeq.delete(key);
      }
    } else {
      this.lastSeq.clear();
    }
  }

  /* ─── Connection state ─────────────────────────────── */

  onStateChange(listener: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private setState(state: ConnectionState): void {
    this._state = state;
    for (const listener of this.stateListeners) {
      listener(state);
    }
  }
}

export const ws = new NovExWebSocket();
