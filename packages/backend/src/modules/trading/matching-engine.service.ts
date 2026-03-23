import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Decimal from 'decimal.js';

/* ─── Types ────────────────────────────────────────────── */

export interface BookOrder {
  id: string;
  userId: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: Decimal;
  remainingQty: Decimal;
  timestamp: number; // epoch ms — used for time priority
  /** True for market orders — skip price check, never rest on book */
  isMarket?: boolean;
}

export interface MatchResult {
  makerOrderId: string;
  takerOrderId: string;
  makerUserId: string;
  takerUserId: string;
  price: Decimal;
  quantity: Decimal;
  takerSide: 'buy' | 'sell';
  symbol: string;
}

export type StpMode = 'cancel_taker' | 'cancel_maker' | 'none';

export interface StpEvent {
  symbol: string;
  userId: string;
  takerOrderId: string;
  makerOrderId: string;
  mode: StpMode;
  /** Which order was cancelled: 'taker' or 'maker' */
  cancelled: 'taker' | 'maker';
  remainingQty: string;
}

interface OrderBookSide {
  orders: BookOrder[];
}

interface PairBook {
  bids: OrderBookSide; // buy  — sorted price DESC, then time ASC
  asks: OrderBookSide; // sell — sorted price ASC,  then time ASC
  stpMode: StpMode;
}

export interface AddOrderResult {
  trades: MatchResult[];
  stpEvents: StpEvent[];
}

/* ─── Engine ───────────────────────────────────────────── */

@Injectable()
export class MatchingEngineService {
  private readonly logger = new Logger(MatchingEngineService.name);
  private readonly books = new Map<string, PairBook>();

  constructor(private readonly events: EventEmitter2) {}

  /* ─── Public API ────────────────────────────────────── */

  /** Configure STP mode for a symbol. Call once per pair at startup or pair creation. */
  setStpMode(symbol: string, mode: StpMode): void {
    const book = this.getOrCreateBook(symbol);
    book.stpMode = mode;
  }

  getStpMode(symbol: string): StpMode {
    return this.books.get(symbol)?.stpMode ?? 'cancel_taker';
  }

  /**
   * Add an order and attempt to match it.
   * Returns trades produced and any STP cancellation events.
   */
  addOrder(order: BookOrder): AddOrderResult {
    const book = this.getOrCreateBook(order.symbol);
    const result = this.match(order, book);

    // Market orders never rest on the book — only limit orders do
    if (order.remainingQty.gt(0) && !order.isMarket) {
      this.insertOrder(order, book);
    }

    return result;
  }

  /**
   * Cancel an order by ID. Returns true if found and removed.
   */
  cancelOrder(symbol: string, orderId: string): boolean {
    const book = this.books.get(symbol);
    if (!book) return false;

    for (const side of [book.bids, book.asks]) {
      const idx = side.orders.findIndex((o) => o.id === orderId);
      if (idx !== -1) {
        side.orders.splice(idx, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * Snapshot of the order book for a symbol (top N levels).
   */
  getOrderBook(
    symbol: string,
    depth = 50,
  ): { bids: [string, string][]; asks: [string, string][] } {
    const book = this.books.get(symbol);
    if (!book) return { bids: [], asks: [] };

    const aggregate = (
      orders: BookOrder[],
      maxLevels: number,
    ): [string, string][] => {
      const levels = new Map<string, Decimal>();
      for (const o of orders) {
        const key = o.price.toFixed();
        levels.set(key, (levels.get(key) ?? new Decimal(0)).plus(o.remainingQty));
      }
      return [...levels.entries()]
        .slice(0, maxLevels)
        .map(([p, q]) => [p, q.toFixed()]);
    };

    return {
      bids: aggregate(book.bids.orders, depth),
      asks: aggregate(book.asks.orders, depth),
    };
  }

  /* ─── Core matching ─────────────────────────────────── */

  private match(taker: BookOrder, book: PairBook): AddOrderResult {
    const trades: MatchResult[] = [];
    const stpEvents: StpEvent[] = [];
    const oppositeSide = taker.side === 'buy' ? book.asks : book.bids;

    let i = 0;
    while (i < oppositeSide.orders.length && taker.remainingQty.gt(0)) {
      const maker = oppositeSide.orders[i];

      // Price check: skip for market orders (they accept any price)
      if (!taker.isMarket) {
        if (taker.side === 'buy' && taker.price.lt(maker.price)) break;
        if (taker.side === 'sell' && taker.price.gt(maker.price)) break;
      }

      // ── Self-Trade Prevention ───────────────────────
      if (maker.userId === taker.userId && book.stpMode !== 'none') {
        if (book.stpMode === 'cancel_taker') {
          // Cancel the taker — stop matching entirely
          stpEvents.push({
            symbol: taker.symbol,
            userId: taker.userId,
            takerOrderId: taker.id,
            makerOrderId: maker.id,
            mode: book.stpMode,
            cancelled: 'taker',
            remainingQty: taker.remainingQty.toFixed(),
          });
          this.logger.warn(
            `STP cancel_taker: ${taker.symbol} order ${taker.id} would self-trade with ${maker.id}`,
          );
          taker.remainingQty = new Decimal(0); // exhaust taker
          break;
        } else if (book.stpMode === 'cancel_maker') {
          // Cancel the resting maker — remove and continue
          stpEvents.push({
            symbol: taker.symbol,
            userId: taker.userId,
            takerOrderId: taker.id,
            makerOrderId: maker.id,
            mode: book.stpMode,
            cancelled: 'maker',
            remainingQty: maker.remainingQty.toFixed(),
          });
          this.logger.warn(
            `STP cancel_maker: ${taker.symbol} removing resting order ${maker.id}`,
          );
          oppositeSide.orders.splice(i, 1);
          continue; // don't increment i
        }
      }

      // Determine fill quantity
      const fillQty = Decimal.min(taker.remainingQty, maker.remainingQty);

      // Execute at maker's price (price-time priority: maker was first)
      const trade: MatchResult = {
        makerOrderId: maker.id,
        takerOrderId: taker.id,
        makerUserId: maker.userId,
        takerUserId: taker.userId,
        price: maker.price,
        quantity: fillQty,
        takerSide: taker.side,
        symbol: taker.symbol,
      };

      trades.push(trade);

      taker.remainingQty = taker.remainingQty.minus(fillQty);
      maker.remainingQty = maker.remainingQty.minus(fillQty);

      // Remove fully filled maker
      if (maker.remainingQty.isZero()) {
        oppositeSide.orders.splice(i, 1);
      } else {
        i++;
      }
    }

    // Emit trade events
    for (const trade of trades) {
      this.events.emit('trade.executed', trade);
      this.logger.log(
        `Trade: ${trade.symbol} ${trade.quantity.toFixed()} @ ${trade.price.toFixed()}`,
      );
    }

    // Emit STP events
    for (const stp of stpEvents) {
      this.events.emit('stp.triggered', stp);
    }

    return { trades, stpEvents };
  }

  /* ─── Book helpers ──────────────────────────────────── */

  private getOrCreateBook(symbol: string): PairBook {
    let book = this.books.get(symbol);
    if (!book) {
      book = {
        bids: { orders: [] },
        asks: { orders: [] },
        stpMode: 'cancel_taker', // default
      };
      this.books.set(symbol, book);
    }
    return book;
  }

  /**
   * Insert order into the correct position maintaining sort invariant.
   */
  private insertOrder(order: BookOrder, book: PairBook): void {
    const side = order.side === 'buy' ? book.bids : book.asks;
    const arr = side.orders;

    let lo = 0;
    let hi = arr.length;

    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      const cmp = this.compare(order, arr[mid], order.side);
      if (cmp < 0) {
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }

    arr.splice(lo, 0, order);
  }

  /**
   * Compare two orders for sort position.
   * Returns < 0 if `a` should come BEFORE `b`.
   */
  private compare(a: BookOrder, b: BookOrder, side: 'buy' | 'sell'): number {
    const priceDiff = side === 'buy'
      ? b.price.minus(a.price).toNumber()   // bids: higher price first
      : a.price.minus(b.price).toNumber();  // asks: lower price first

    if (priceDiff !== 0) return priceDiff;

    return a.timestamp - b.timestamp;
  }
}
