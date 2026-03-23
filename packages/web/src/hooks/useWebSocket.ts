'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ws,
  type ConnectionState,
  type WsTradeEvent,
  type WsTickerEvent,
  type WsOrderBookEvent,
  type WsOrderEvent,
  type WsFillEvent,
  type WsBalanceEvent,
} from '@/lib/ws';

/**
 * Hook: manage WebSocket connection lifecycle.
 * Call once in a layout/provider — keeps connection alive across pages.
 */
export function useWsConnection() {
  const [state, setState] = useState<ConnectionState>(ws.state);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    ws.connect();

    const unsub = ws.onStateChange((s) => {
      if (mountedRef.current) setState(s);
    });

    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, []);

  return state;
}

/**
 * Hook: subscribe to public market channels for a symbol.
 * Handles subscribe/unsubscribe on symbol change and cleanup on unmount.
 */
export function useMarketStream(
  symbol: string,
  handlers: {
    onTrade?: (e: WsTradeEvent) => void;
    onTicker?: (e: WsTickerEvent) => void;
    onOrderBookSnapshot?: (e: WsOrderBookEvent) => void;
    onOrderBookUpdate?: (e: WsOrderBookEvent) => void;
  },
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!symbol) return;

    const channels = ['ticker', 'trades', 'orderbook'];

    // Register event handlers
    const unsubs: Array<() => void> = [];

    unsubs.push(
      ws.on('trade', (e: WsTradeEvent) => {
        if (e.symbol === symbol && ws.shouldApply(`${symbol}:trades`, e.seq)) {
          handlersRef.current.onTrade?.(e);
        }
      }),
    );

    unsubs.push(
      ws.on('ticker:update', (e: WsTickerEvent) => {
        if (e.symbol === symbol && ws.shouldApply(`${symbol}:ticker`, e.seq)) {
          handlersRef.current.onTicker?.(e);
        }
      }),
    );

    unsubs.push(
      ws.on('orderbook:snapshot', (e: WsOrderBookEvent) => {
        if (e.symbol === symbol) {
          ws.resetSeq(`${symbol}:orderbook`);
          ws.shouldApply(`${symbol}:orderbook`, e.seq);
          handlersRef.current.onOrderBookSnapshot?.(e);
        }
      }),
    );

    unsubs.push(
      ws.on('orderbook:update', (e: WsOrderBookEvent) => {
        if (e.symbol === symbol && ws.shouldApply(`${symbol}:orderbook`, e.seq)) {
          handlersRef.current.onOrderBookUpdate?.(e);
        }
      }),
    );

    // Subscribe
    ws.subscribe(symbol, channels);

    return () => {
      ws.unsubscribe(symbol, channels);
      ws.resetSeq(symbol);
      unsubs.forEach((u) => u());
    };
  }, [symbol]);
}

/**
 * Hook: subscribe to private account streams (auth required).
 * Handles order updates, fill notifications, and balance changes.
 */
export function useAccountStream(handlers: {
  onOrder?: (e: WsOrderEvent) => void;
  onFill?: (e: WsFillEvent) => void;
  onBalance?: (e: WsBalanceEvent) => void;
}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    unsubs.push(
      ws.on('account:order', (e: WsOrderEvent) => {
        if (ws.shouldApply('account:order', e.seq)) {
          handlersRef.current.onOrder?.(e);
        }
      }),
    );

    unsubs.push(
      ws.on('account:fill', (e: WsFillEvent) => {
        if (ws.shouldApply('account:fill', e.seq)) {
          handlersRef.current.onFill?.(e);
        }
      }),
    );

    unsubs.push(
      ws.on('account:balance', (e: WsBalanceEvent) => {
        if (ws.shouldApply('account:balance', e.seq)) {
          handlersRef.current.onBalance?.(e);
        }
      }),
    );

    return () => unsubs.forEach((u) => u());
  }, []);
}

export { type ConnectionState };
