/**
 * NovEx — Matching Engine Unit Tests (v2)
 *
 * Pure unit tests — no database. Tests the in-memory order book,
 * price-time priority, STP, and event emission.
 *
 * Run: npm run test:engine:unit
 */
import { EventEmitter2 } from '@nestjs/event-emitter';
import Decimal from 'decimal.js';
import {
  MatchingEngineService,
  BookOrder,
  MatchResult,
  StpEvent,
  AddOrderResult,
} from '../matching-engine.service';
import { makeBookOrder, resetFixtures } from './fixtures';

describe('MatchingEngineService', () => {
  let engine: MatchingEngineService;
  let events: EventEmitter2;
  let emittedTrades: MatchResult[];
  let emittedStp: StpEvent[];

  beforeEach(() => {
    resetFixtures();
    events = new EventEmitter2();
    engine = new MatchingEngineService(events);
    emittedTrades = [];
    emittedStp = [];

    events.on('trade.executed', (t: MatchResult) => emittedTrades.push(t));
    events.on('stp.triggered', (e: StpEvent) => emittedStp.push(e));
  });

  /* ═══════════════════════════════════════════════════════
   * 1. Full Execution at Same Price
   * ═══════════════════════════════════════════════════════ */
  describe('Full Execution at Same Price', () => {
    it('fully fills both orders when buy meets sell at same price', () => {
      const seller = makeBookOrder({
        side: 'sell', price: new Decimal('50000'), remainingQty: new Decimal('1'),
        userId: 'seller-1', timestamp: 1,
      });
      const buyer = makeBookOrder({
        side: 'buy', price: new Decimal('50000'), remainingQty: new Decimal('1'),
        userId: 'buyer-1', timestamp: 2,
      });

      engine.addOrder(seller);
      const { trades } = engine.addOrder(buyer);

      expect(trades).toHaveLength(1);
      expect(trades[0].price.eq(new Decimal('50000'))).toBe(true);
      expect(trades[0].quantity.eq(new Decimal('1'))).toBe(true);
      expect(trades[0].makerUserId).toBe('seller-1');
      expect(trades[0].takerUserId).toBe('buyer-1');
      expect(trades[0].takerSide).toBe('buy');

      const book = engine.getOrderBook('BTC_USDT');
      expect(book.bids).toHaveLength(0);
      expect(book.asks).toHaveLength(0);
      expect(emittedTrades).toHaveLength(1);
    });

    it('executes at maker price when taker offers a better price', () => {
      engine.addOrder(makeBookOrder({
        side: 'sell', price: new Decimal('49500'), remainingQty: new Decimal('2'), timestamp: 1,
      }));
      const { trades } = engine.addOrder(makeBookOrder({
        side: 'buy', price: new Decimal('50000'), remainingQty: new Decimal('2'), timestamp: 2,
      }));

      expect(trades[0].price.eq(new Decimal('49500'))).toBe(true);
    });
  });

  /* ═══════════════════════════════════════════════════════
   * 2. Partial Fill
   * ═══════════════════════════════════════════════════════ */
  describe('Partial Fill', () => {
    it('partially fills a large resting order', () => {
      engine.addOrder(makeBookOrder({
        side: 'sell', price: new Decimal('50000'), remainingQty: new Decimal('10'), timestamp: 1,
      }));
      const { trades } = engine.addOrder(makeBookOrder({
        side: 'buy', price: new Decimal('50000'), remainingQty: new Decimal('3'), timestamp: 2,
      }));

      expect(trades).toHaveLength(1);
      expect(trades[0].quantity.eq(new Decimal('3'))).toBe(true);
      const book = engine.getOrderBook('BTC_USDT');
      expect(new Decimal(book.asks[0][1]).eq(new Decimal('7'))).toBe(true);
      expect(book.bids).toHaveLength(0);
    });

    it('rests taker when resting is smaller', () => {
      engine.addOrder(makeBookOrder({
        side: 'sell', price: new Decimal('50000'), remainingQty: new Decimal('2'), timestamp: 1,
      }));
      const { trades } = engine.addOrder(makeBookOrder({
        side: 'buy', price: new Decimal('50000'), remainingQty: new Decimal('5'), timestamp: 2,
      }));

      expect(trades[0].quantity.eq(new Decimal('2'))).toBe(true);
      const book = engine.getOrderBook('BTC_USDT');
      expect(new Decimal(book.bids[0][1]).eq(new Decimal('3'))).toBe(true);
    });
  });

  /* ═══════════════════════════════════════════════════════
   * 3. Price-Time Priority
   * ═══════════════════════════════════════════════════════ */
  describe('Price-Time Priority', () => {
    it('matches best ask (lowest) first', () => {
      engine.addOrder(makeBookOrder({
        side: 'sell', price: new Decimal('50100'), remainingQty: new Decimal('1'),
        userId: 'seller-expensive', timestamp: 1,
      }));
      engine.addOrder(makeBookOrder({
        side: 'sell', price: new Decimal('50000'), remainingQty: new Decimal('1'),
        userId: 'seller-cheap', timestamp: 2,
      }));

      const { trades } = engine.addOrder(makeBookOrder({
        side: 'buy', price: new Decimal('50100'), remainingQty: new Decimal('1'), timestamp: 3,
      }));

      expect(trades[0].price.eq(new Decimal('50000'))).toBe(true);
      expect(trades[0].makerUserId).toBe('seller-cheap');
    });

    it('matches best bid (highest) first', () => {
      engine.addOrder(makeBookOrder({
        side: 'buy', price: new Decimal('49900'), remainingQty: new Decimal('1'),
        userId: 'buyer-low', timestamp: 1,
      }));
      engine.addOrder(makeBookOrder({
        side: 'buy', price: new Decimal('50000'), remainingQty: new Decimal('1'),
        userId: 'buyer-high', timestamp: 2,
      }));

      const { trades } = engine.addOrder(makeBookOrder({
        side: 'sell', price: new Decimal('49900'), remainingQty: new Decimal('1'), timestamp: 3,
      }));

      expect(trades[0].price.eq(new Decimal('50000'))).toBe(true);
      expect(trades[0].makerUserId).toBe('buyer-high');
    });

    it('uses time priority at same price level', () => {
      engine.addOrder(makeBookOrder({
        side: 'sell', price: new Decimal('50000'), remainingQty: new Decimal('1'),
        userId: 'first', timestamp: 100,
      }));
      engine.addOrder(makeBookOrder({
        side: 'sell', price: new Decimal('50000'), remainingQty: new Decimal('1'),
        userId: 'second', timestamp: 200,
      }));

      const { trades } = engine.addOrder(makeBookOrder({
        side: 'buy', price: new Decimal('50000'), remainingQty: new Decimal('1'), timestamp: 300,
      }));

      expect(trades[0].makerUserId).toBe('first');
    });

    it('sweeps multiple price levels', () => {
      engine.addOrder(makeBookOrder({ side: 'sell', price: new Decimal('50000'), remainingQty: new Decimal('1'), userId: 's1', timestamp: 1 }));
      engine.addOrder(makeBookOrder({ side: 'sell', price: new Decimal('50100'), remainingQty: new Decimal('1'), userId: 's2', timestamp: 2 }));
      engine.addOrder(makeBookOrder({ side: 'sell', price: new Decimal('50200'), remainingQty: new Decimal('1'), userId: 's3', timestamp: 3 }));

      const { trades } = engine.addOrder(makeBookOrder({
        side: 'buy', price: new Decimal('50200'), remainingQty: new Decimal('2.5'), timestamp: 4,
      }));

      expect(trades).toHaveLength(3);
      expect(trades[0].price.eq(new Decimal('50000'))).toBe(true);
      expect(trades[1].price.eq(new Decimal('50100'))).toBe(true);
      expect(trades[2].price.eq(new Decimal('50200'))).toBe(true);
      expect(trades[2].quantity.eq(new Decimal('0.5'))).toBe(true);
    });
  });

  /* ═══════════════════════════════════════════════════════
   * 4. No match on price gap
   * ═══════════════════════════════════════════════════════ */
  describe('No Match', () => {
    it('no match when buy < ask', () => {
      engine.addOrder(makeBookOrder({ side: 'sell', price: new Decimal('51000'), remainingQty: new Decimal('1'), timestamp: 1 }));
      const { trades } = engine.addOrder(makeBookOrder({ side: 'buy', price: new Decimal('50000'), remainingQty: new Decimal('1'), timestamp: 2 }));
      expect(trades).toHaveLength(0);
    });
  });

  /* ═══════════════════════════════════════════════════════
   * 5. Cancel
   * ═══════════════════════════════════════════════════════ */
  describe('Cancel', () => {
    it('removes and returns true', () => {
      const o = makeBookOrder({ side: 'buy', price: new Decimal('50000'), timestamp: 1 });
      engine.addOrder(o);
      expect(engine.cancelOrder('BTC_USDT', o.id)).toBe(true);
      expect(engine.getOrderBook('BTC_USDT').bids).toHaveLength(0);
    });

    it('returns false for non-existent', () => {
      expect(engine.cancelOrder('BTC_USDT', 'nope')).toBe(false);
    });
  });

  /* ═══════════════════════════════════════════════════════
   * STP — Self-Trade Prevention
   * ═══════════════════════════════════════════════════════ */
  describe('Self-Trade Prevention', () => {
    it('cancel_taker: prevents self-trade and cancels taker', () => {
      engine.setStpMode('BTC_USDT', 'cancel_taker');
      const userId = 'same-user';

      engine.addOrder(makeBookOrder({
        side: 'sell', price: new Decimal('50000'), remainingQty: new Decimal('1'),
        userId, timestamp: 1,
      }));
      const { trades, stpEvents } = engine.addOrder(makeBookOrder({
        side: 'buy', price: new Decimal('50000'), remainingQty: new Decimal('1'),
        userId, timestamp: 2,
      }));

      expect(trades).toHaveLength(0);
      expect(stpEvents).toHaveLength(1);
      expect(stpEvents[0].cancelled).toBe('taker');
      expect(stpEvents[0].userId).toBe(userId);
      expect(emittedStp).toHaveLength(1);

      // Maker still resting on book
      const book = engine.getOrderBook('BTC_USDT');
      expect(book.asks).toHaveLength(1);
      // Taker not resting
      expect(book.bids).toHaveLength(0);
    });

    it('cancel_maker: removes resting order and matches next', () => {
      engine.setStpMode('BTC_USDT', 'cancel_maker');
      const userId = 'same-user';

      // Same user rests an ask
      engine.addOrder(makeBookOrder({
        side: 'sell', price: new Decimal('50000'), remainingQty: new Decimal('1'),
        userId, timestamp: 1,
      }));
      // Different user also has an ask at same price
      engine.addOrder(makeBookOrder({
        side: 'sell', price: new Decimal('50000'), remainingQty: new Decimal('1'),
        userId: 'other-user', timestamp: 2,
      }));

      // Same user places buy — should skip own ask, match other's
      const { trades, stpEvents } = engine.addOrder(makeBookOrder({
        side: 'buy', price: new Decimal('50000'), remainingQty: new Decimal('1'),
        userId, timestamp: 3,
      }));

      expect(stpEvents).toHaveLength(1);
      expect(stpEvents[0].cancelled).toBe('maker');
      expect(trades).toHaveLength(1);
      expect(trades[0].makerUserId).toBe('other-user');
    });

    it('stp=none: allows self-trades', () => {
      engine.setStpMode('BTC_USDT', 'none');
      const userId = 'same-user';

      engine.addOrder(makeBookOrder({
        side: 'sell', price: new Decimal('50000'), remainingQty: new Decimal('1'),
        userId, timestamp: 1,
      }));
      const { trades, stpEvents } = engine.addOrder(makeBookOrder({
        side: 'buy', price: new Decimal('50000'), remainingQty: new Decimal('1'),
        userId, timestamp: 2,
      }));

      expect(trades).toHaveLength(1);
      expect(stpEvents).toHaveLength(0);
    });

    it('STP does not affect different users crossing', () => {
      engine.setStpMode('BTC_USDT', 'cancel_taker');

      engine.addOrder(makeBookOrder({
        side: 'sell', price: new Decimal('50000'), remainingQty: new Decimal('1'),
        userId: 'alice', timestamp: 1,
      }));
      const { trades, stpEvents } = engine.addOrder(makeBookOrder({
        side: 'buy', price: new Decimal('50000'), remainingQty: new Decimal('1'),
        userId: 'bob', timestamp: 2,
      }));

      expect(trades).toHaveLength(1);
      expect(stpEvents).toHaveLength(0);
    });
  });

  /* ═══════════════════════════════════════════════════════
   * Edge Cases
   * ═══════════════════════════════════════════════════════ */
  describe('Edge Cases', () => {
    it('handles very small quantities', () => {
      engine.addOrder(makeBookOrder({ side: 'sell', price: new Decimal('50000'), remainingQty: new Decimal('0.00000001'), timestamp: 1 }));
      const { trades } = engine.addOrder(makeBookOrder({ side: 'buy', price: new Decimal('50000'), remainingQty: new Decimal('0.00000001'), timestamp: 2 }));
      expect(trades[0].quantity.eq(new Decimal('0.00000001'))).toBe(true);
    });

    it('handles multiple symbols independently', () => {
      engine.addOrder(makeBookOrder({ symbol: 'BTC_USDT', side: 'sell', price: new Decimal('50000'), remainingQty: new Decimal('1'), timestamp: 1 }));
      engine.addOrder(makeBookOrder({ symbol: 'ETH_USDT', side: 'sell', price: new Decimal('3000'), remainingQty: new Decimal('10'), timestamp: 2 }));

      const { trades } = engine.addOrder(makeBookOrder({ symbol: 'BTC_USDT', side: 'buy', price: new Decimal('50000'), remainingQty: new Decimal('1'), timestamp: 3 }));
      expect(trades).toHaveLength(1);
      expect(trades[0].symbol).toBe('BTC_USDT');
      expect(engine.getOrderBook('ETH_USDT').asks).toHaveLength(1);
    });
  });
});
