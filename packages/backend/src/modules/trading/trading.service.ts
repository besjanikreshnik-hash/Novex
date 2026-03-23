import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not, IsNull } from 'typeorm';
import Decimal from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import { Order, OrderSide, OrderType, OrderStatus } from './entities/order.entity';
import { Trade } from './entities/trade.entity';
import { TradingPair } from './entities/trading-pair.entity';
import { FeeLedger } from './entities/fee-ledger.entity';
import { WalletsService } from '../wallets/wallets.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  MatchingEngineService,
  BookOrder,
  MatchResult,
  AddOrderResult,
  StpEvent,
} from './matching-engine.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.entity';

export interface PlaceOrderDto {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  /** Required for limit orders, ignored for market orders */
  price?: string;
  quantity: string;
  /** Optional: max acceptable average price for market buys, min for market sells */
  slippagePrice?: string;
  /** Required for stop_limit orders: the trigger price */
  stopPrice?: string;
  /** Trailing distance in price units (for trailing_stop orders) */
  trailingDelta?: string;
  /** Price at which trailing stop activates (for trailing_stop orders) */
  trailingActivationPrice?: string;
}

export interface PlaceOCODto {
  symbol: string;
  side: OrderSide;
  limitPrice: string;
  limitQuantity: string;
  stopPrice: string;
  stopQuantity: string;
}

@Injectable()
export class TradingService {
  private readonly logger = new Logger(TradingService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Trade)
    private readonly tradeRepo: Repository<Trade>,
    @InjectRepository(TradingPair)
    private readonly pairRepo: Repository<TradingPair>,
    private readonly wallets: WalletsService,
    private readonly engine: MatchingEngineService,
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
    private readonly notifications: NotificationsService,
  ) {}

  /* ────── Place Order ──────────────────────────────── */
  async placeOrder(userId: string, dto: PlaceOrderDto): Promise<Order> {
    const pair = await this.pairRepo.findOne({
      where: { symbol: dto.symbol, isActive: true },
    });
    if (!pair) {
      throw new BadRequestException(`Trading pair ${dto.symbol} not found or inactive`);
    }

    const isMarket = dto.type === OrderType.MARKET;
    const isStopLimit = dto.type === OrderType.STOP_LIMIT;
    const isTrailingStop = dto.type === OrderType.TRAILING_STOP;
    const quantity = new Decimal(dto.quantity);

    if (quantity.lte(0)) {
      throw new BadRequestException('Quantity must be positive');
    }
    if (quantity.lt(pair.minQuantity)) {
      throw new BadRequestException(`Minimum quantity is ${pair.minQuantity}`);
    }
    const maxQty = new Decimal(pair.maxQuantity);
    if (maxQty.gt(0) && quantity.gt(maxQty)) {
      throw new BadRequestException(`Maximum quantity is ${pair.maxQuantity}`);
    }

    // ── Stop-limit validation ─────────────────────────────
    if (isStopLimit) {
      if (!dto.stopPrice) {
        throw new BadRequestException('stopPrice is required for stop_limit orders');
      }
      if (!dto.price) {
        throw new BadRequestException('price is required for stop_limit orders');
      }
      const sp = new Decimal(dto.stopPrice);
      if (sp.lte(0)) {
        throw new BadRequestException('stopPrice must be positive');
      }
    }

    // ── Trailing stop validation ─────────────────────────
    if (isTrailingStop) {
      if (!dto.trailingDelta) {
        throw new BadRequestException('trailingDelta is required for trailing_stop orders');
      }
      const delta = new Decimal(dto.trailingDelta);
      if (delta.lte(0)) {
        throw new BadRequestException('trailingDelta must be positive');
      }
      if (dto.trailingActivationPrice) {
        const actPrice = new Decimal(dto.trailingActivationPrice);
        if (actPrice.lte(0)) {
          throw new BadRequestException('trailingActivationPrice must be positive');
        }
      }
      // Trailing stop uses a sentinel price for fund locking (like stop-limit)
      if (!dto.price) {
        // Use activation price or last market price as the limit price estimate
        dto.price = dto.trailingActivationPrice || '0';
      }
    }

    // ── Price handling ──────────────────────────────────
    let price: Decimal;
    if (isMarket) {
      // Market orders don't specify a price — we use a sentinel for fund locking
      // and validate against book liquidity
      const book = this.engine.getOrderBook(dto.symbol, 100);
      const oppositeSide = dto.side === OrderSide.BUY ? book.asks : book.bids;

      if (oppositeSide.length === 0) {
        throw new BadRequestException('No liquidity available for market order');
      }

      // Estimate worst-case execution price for fund locking
      price = this.estimateWorstPrice(oppositeSide, quantity, dto.side);
    } else {
      if (!dto.price) {
        throw new BadRequestException('Price is required for limit orders');
      }
      price = new Decimal(dto.price);
      if (price.lte(0)) {
        throw new BadRequestException('Price must be positive');
      }
    }

    // ── Min notional check ──────────────────────────────
    const notional = price.times(quantity);
    const minNotional = new Decimal(pair.minNotional);
    if (minNotional.gt(0) && notional.lt(minNotional)) {
      throw new BadRequestException(
        `Order value ${notional.toFixed(2)} ${pair.quoteCurrency} below minimum ${minNotional.toFixed(2)} ${pair.quoteCurrency}`,
      );
    }

    // Configure STP mode
    this.engine.setStpMode(dto.symbol, pair.stpMode);

    // ── Lock funds ──────────────────────────────────────
    if (dto.side === OrderSide.BUY) {
      const lockAmount = isMarket
        ? price.times(quantity).times('1.01') // 1% buffer for market buy price movement
        : price.times(quantity);
      await this.wallets.lockFunds(userId, pair.quoteCurrency, lockAmount);
    } else {
      await this.wallets.lockFunds(userId, pair.baseCurrency, quantity);
    }

    // ── Persist order ───────────────────────────────────
    const order = this.orderRepo.create({
      userId,
      symbol: dto.symbol,
      side: dto.side,
      type: dto.type,
      price: isMarket ? '0' : price.toFixed(), // market orders store 0
      quantity: quantity.toFixed(),
      filledQuantity: '0',
      filledQuote: '0',
      baseCurrency: pair.baseCurrency,
      quoteCurrency: pair.quoteCurrency,
      status: OrderStatus.OPEN,
      stopPrice: isStopLimit ? new Decimal(dto.stopPrice!).toFixed() : null,
      ocoGroupId: null,
      trailingDelta: isTrailingStop && dto.trailingDelta ? new Decimal(dto.trailingDelta).toFixed() : null,
      trailingActivationPrice: isTrailingStop && dto.trailingActivationPrice ? new Decimal(dto.trailingActivationPrice).toFixed() : null,
    });
    const saved = await this.orderRepo.save(order);

    // ── Stop-limit / trailing stop: do NOT enter matching engine — wait for trigger ──
    if (isStopLimit || isTrailingStop) {
      this.events.emit('order.placed', { userId, order: saved });
      return saved;
    }

    // ── Submit to matching engine ───────────────────────
    const bookOrder: BookOrder = {
      id: saved.id,
      userId,
      symbol: dto.symbol,
      side: dto.side,
      price: isMarket
        ? (dto.side === OrderSide.BUY ? new Decimal('999999999') : new Decimal('0'))
        : price,
      remainingQty: quantity,
      timestamp: Date.now(),
      isMarket,
    };

    const result: AddOrderResult = this.engine.addOrder(bookOrder);

    // ── Process trades ──────────────────────────────────
    if (result.trades.length > 0) {
      await this.processMatches(result.trades, pair);
    }

    // ── Handle STP ──────────────────────────────────────
    if (result.stpEvents.length > 0) {
      await this.handleStpEvents(result.stpEvents, saved, pair);
    }

    // ── Reload order ────────────────────────────────────
    const finalOrder = await this.orderRepo.findOneOrFail({ where: { id: saved.id } });

    // ── Market order: unlock excess locked funds ────────
    if (isMarket && dto.side === OrderSide.BUY) {
      const totalLocked = isMarket
        ? price.times(quantity).times('1.01')
        : price.times(quantity);
      const actualSpent = new Decimal(finalOrder.filledQuote);
      const excess = totalLocked.minus(actualSpent);
      if (excess.gt(0)) {
        await this.wallets.unlockFunds(userId, pair.quoteCurrency, excess);
      }
    }

    // ── Market order: cancel unfilled remainder ─────────
    if (isMarket && finalOrder.status === OrderStatus.OPEN) {
      // Market order didn't fully fill — mark as cancelled (partial fill)
      finalOrder.status = new Decimal(finalOrder.filledQuantity).gt(0)
        ? OrderStatus.CANCELLED // partial fill + cancel remainder
        : OrderStatus.CANCELLED;
      await this.orderRepo.save(finalOrder);

      // Unlock unfilled portion for sell side
      if (dto.side === OrderSide.SELL) {
        const unfilled = quantity.minus(finalOrder.filledQuantity);
        if (unfilled.gt(0)) {
          await this.wallets.unlockFunds(userId, pair.baseCurrency, unfilled);
        }
      }
    }

    // ── Slippage protection ─────────────────────────────
    if (isMarket && dto.slippagePrice && result.trades.length > 0) {
      const slippageLimit = new Decimal(dto.slippagePrice);
      const filledQty = new Decimal(finalOrder.filledQuantity);
      const filledQuote = new Decimal(finalOrder.filledQuote);
      if (filledQty.gt(0)) {
        const avgPrice = filledQuote.div(filledQty);
        if (dto.side === OrderSide.BUY && avgPrice.gt(slippageLimit)) {
          this.logger.warn(
            `Slippage exceeded for order ${finalOrder.id}: avg ${avgPrice.toFixed()} > limit ${slippageLimit.toFixed()}`,
          );
          // Note: trade already executed. Slippage is a soft warning here.
          // For hard slippage, the check must happen pre-match. The current
          // approach logs and the client can use estimated price for UX.
        }
      }
    }

    // Reload after possible status change
    const reloaded = await this.orderRepo.findOneOrFail({ where: { id: saved.id } });

    // ── Emit events ─────────────────────────────────────
    this.events.emit('order.placed', { userId, order: reloaded });
    if (result.trades.length > 0) {
      this.emitBalanceUpdates(userId, pair).catch(() => {});
      for (const m of result.trades) {
        const otherUser = m.makerUserId === userId ? m.takerUserId : m.makerUserId;
        this.emitBalanceUpdates(otherUser, pair).catch(() => {});
      }
    }

    return reloaded;
  }

  /* ────── Estimate worst execution price from book ──── */
  private estimateWorstPrice(
    levels: [string, string][],
    quantity: Decimal,
    side: OrderSide,
  ): Decimal {
    let remaining = quantity;
    let worstPrice = new Decimal(levels[0][0]);

    for (const [priceStr, qtyStr] of levels) {
      const levelQty = new Decimal(qtyStr);
      const levelPrice = new Decimal(priceStr);
      worstPrice = levelPrice;
      remaining = remaining.minus(Decimal.min(remaining, levelQty));
      if (remaining.lte(0)) break;
    }

    return worstPrice;
  }

  /* ────── Cancel Order ─────────────────────────────── */
  async cancelOrder(userId: string, orderId: string): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.userId !== userId) {
      throw new ForbiddenException('Not your order');
    }
    if (
      order.status !== OrderStatus.OPEN &&
      order.status !== OrderStatus.PARTIALLY_FILLED
    ) {
      throw new BadRequestException('Order cannot be cancelled');
    }

    this.engine.cancelOrder(order.symbol, order.id);

    const remaining = new Decimal(order.quantity).minus(order.filledQuantity);
    if (remaining.gt(0)) {
      if (order.side === OrderSide.BUY) {
        const unlockAmount = remaining.times(order.price);
        await this.wallets.unlockFunds(userId, order.quoteCurrency, unlockAmount);
      } else {
        await this.wallets.unlockFunds(userId, order.baseCurrency, remaining);
      }
    }

    order.status = OrderStatus.CANCELLED;
    const cancelled = await this.orderRepo.save(order);

    // Emit cancel event for WebSocket push
    this.events.emit('order.cancelled', { userId, order: cancelled });
    // Emit balance update (funds unlocked)
    const pair = await this.pairRepo.findOne({ where: { symbol: order.symbol } });
    if (pair) this.emitBalanceUpdates(userId, pair).catch(() => {});

    return cancelled;
  }

  /* ────── Check & Trigger Stop Orders ─────────────── */

  /**
   * Scans open stop-limit orders for a symbol and triggers any whose
   * stop condition is met by the given lastPrice.
   *
   * Buy  stop-limit: triggers when lastPrice >= stopPrice
   * Sell stop-limit: triggers when lastPrice <= stopPrice
   *
   * Triggered orders are submitted to the matching engine as limit orders.
   */
  async checkStopOrders(symbol: string, lastPrice: Decimal): Promise<void> {
    // ── Check standard stop-limit orders ─────────────────
    const stopOrders = await this.orderRepo.find({
      where: {
        symbol,
        type: OrderType.STOP_LIMIT,
        status: OrderStatus.OPEN,
      },
    });

    for (const order of stopOrders) {
      const stopPrice = new Decimal(order.stopPrice!);
      const shouldTrigger =
        order.side === OrderSide.BUY
          ? lastPrice.gte(stopPrice)
          : lastPrice.lte(stopPrice);

      if (!shouldTrigger) continue;

      this.logger.log(
        `Stop-limit triggered: ${order.id} ${order.side} ${order.symbol} ` +
        `stopPrice=${stopPrice.toFixed()} lastPrice=${lastPrice.toFixed()}`,
      );

      await this.triggerStopOrder(order);
    }

    // ── Check trailing stop orders ───────────────────────
    const trailingOrders = await this.orderRepo.find({
      where: {
        symbol,
        type: OrderType.TRAILING_STOP,
        status: OrderStatus.OPEN,
      },
    });

    for (const order of trailingOrders) {
      const delta = new Decimal(order.trailingDelta!);
      const activationPrice = order.trailingActivationPrice
        ? new Decimal(order.trailingActivationPrice)
        : null;

      // If activation price is set, check whether the market has reached it
      if (activationPrice) {
        const activated =
          order.side === OrderSide.BUY
            ? lastPrice.lte(activationPrice) // buy trailing activates when price dips to activation
            : lastPrice.gte(activationPrice); // sell trailing activates when price rises to activation
        if (!activated) continue;
      }

      // Trailing logic:
      //   Sell trailing: track highest price, trigger when price drops by delta from high
      //   Buy trailing: track lowest price, trigger when price rises by delta from low
      //
      // We store the tracked extreme in stopPrice field (reused):
      //   - null means no extreme tracked yet — initialize it
      const currentExtreme = order.stopPrice ? new Decimal(order.stopPrice) : null;

      if (order.side === OrderSide.SELL) {
        // Track the highest price
        const newHigh = currentExtreme === null || lastPrice.gt(currentExtreme)
          ? lastPrice
          : currentExtreme;

        // Trigger when price falls by delta from the high
        const triggerPrice = newHigh.minus(delta);
        if (lastPrice.lte(triggerPrice)) {
          this.logger.log(
            `Trailing stop triggered (sell): ${order.id} high=${newHigh.toFixed()} ` +
            `delta=${delta.toFixed()} lastPrice=${lastPrice.toFixed()}`,
          );
          // Set the limit price to the current last price for market-like execution
          order.price = lastPrice.toFixed();
          await this.triggerStopOrder(order);
        } else {
          // Update tracked high
          order.stopPrice = newHigh.toFixed();
          await this.orderRepo.save(order);
        }
      } else {
        // BUY trailing: track the lowest price
        const newLow = currentExtreme === null || lastPrice.lt(currentExtreme)
          ? lastPrice
          : currentExtreme;

        // Trigger when price rises by delta from the low
        const triggerPrice = newLow.plus(delta);
        if (lastPrice.gte(triggerPrice)) {
          this.logger.log(
            `Trailing stop triggered (buy): ${order.id} low=${newLow.toFixed()} ` +
            `delta=${delta.toFixed()} lastPrice=${lastPrice.toFixed()}`,
          );
          order.price = lastPrice.toFixed();
          await this.triggerStopOrder(order);
        } else {
          // Update tracked low
          order.stopPrice = newLow.toFixed();
          await this.orderRepo.save(order);
        }
      }
    }
  }

  /* ────── Trigger a stop/trailing order into the matching engine ── */
  private async triggerStopOrder(order: Order): Promise<void> {
    order.status = OrderStatus.TRIGGERED;
    await this.orderRepo.save(order);

    const pair = await this.pairRepo.findOne({
      where: { symbol: order.symbol, isActive: true },
    });
    if (!pair) {
      this.logger.warn(`Stop order ${order.id} triggered but pair ${order.symbol} inactive`);
      return;
    }

    this.engine.setStpMode(order.symbol, pair.stpMode);

    const price = new Decimal(order.price);
    const remainingQty = new Decimal(order.quantity).minus(order.filledQuantity);

    const bookOrder: BookOrder = {
      id: order.id,
      userId: order.userId,
      symbol: order.symbol,
      side: order.side,
      price,
      remainingQty,
      timestamp: Date.now(),
      isMarket: false,
    };

    const result: AddOrderResult = this.engine.addOrder(bookOrder);

    if (result.trades.length > 0) {
      await this.processMatches(result.trades, pair);
    }

    if (result.stpEvents.length > 0) {
      const reloadedOrder = await this.orderRepo.findOneOrFail({ where: { id: order.id } });
      await this.handleStpEvents(result.stpEvents, reloadedOrder, pair);
    }

    // Reload and emit events
    const finalOrder = await this.orderRepo.findOneOrFail({ where: { id: order.id } });
    this.events.emit('order.placed', { userId: order.userId, order: finalOrder });

    // Cancel OCO sibling if this order is part of an OCO group
    if (finalOrder.ocoGroupId) {
      await this.cancelOcoSibling(finalOrder);
    }

    if (result.trades.length > 0) {
      this.emitBalanceUpdates(order.userId, pair).catch(() => {});
      for (const m of result.trades) {
        const otherUser = m.makerUserId === order.userId ? m.takerUserId : m.makerUserId;
        this.emitBalanceUpdates(otherUser, pair).catch(() => {});
      }
    }
  }

  /* ────── Place OCO (One-Cancels-Other) ─────────────────── */
  async placeOCO(userId: string, dto: PlaceOCODto): Promise<{ limitOrder: Order; stopOrder: Order }> {
    const pair = await this.pairRepo.findOne({
      where: { symbol: dto.symbol, isActive: true },
    });
    if (!pair) {
      throw new BadRequestException(`Trading pair ${dto.symbol} not found or inactive`);
    }

    const limitPrice = new Decimal(dto.limitPrice);
    const limitQty = new Decimal(dto.limitQuantity);
    const stopPrice = new Decimal(dto.stopPrice);
    const stopQty = new Decimal(dto.stopQuantity);

    if (limitPrice.lte(0) || limitQty.lte(0) || stopPrice.lte(0) || stopQty.lte(0)) {
      throw new BadRequestException('All prices and quantities must be positive');
    }

    const ocoGroupId = uuidv4();

    // Create the limit leg
    const limitOrder = await this.placeOrder(userId, {
      symbol: dto.symbol,
      side: dto.side,
      type: OrderType.LIMIT,
      price: limitPrice.toFixed(),
      quantity: limitQty.toFixed(),
    });

    // Create the stop-limit leg
    const stopOrder = await this.placeOrder(userId, {
      symbol: dto.symbol,
      side: dto.side,
      type: OrderType.STOP_LIMIT,
      price: stopPrice.toFixed(), // limit price = stop price for simplicity
      quantity: stopQty.toFixed(),
      stopPrice: stopPrice.toFixed(),
    });

    // Link them with the OCO group ID
    limitOrder.ocoGroupId = ocoGroupId;
    limitOrder.type = OrderType.OCO;
    stopOrder.ocoGroupId = ocoGroupId;
    stopOrder.type = OrderType.OCO;
    await this.orderRepo.save(limitOrder);
    await this.orderRepo.save(stopOrder);

    return { limitOrder, stopOrder };
  }

  /* ────── Cancel OCO Sibling ─────────────────────────────── */
  private async cancelOcoSibling(filledOrder: Order): Promise<void> {
    if (!filledOrder.ocoGroupId) return;

    const siblings = await this.orderRepo.find({
      where: {
        ocoGroupId: filledOrder.ocoGroupId,
        status: OrderStatus.OPEN,
      },
    });

    for (const sibling of siblings) {
      if (sibling.id === filledOrder.id) continue;
      try {
        await this.cancelOrder(sibling.userId, sibling.id);
        this.logger.log(`OCO sibling cancelled: ${sibling.id} (group ${filledOrder.ocoGroupId})`);
      } catch (err) {
        this.logger.warn(`Failed to cancel OCO sibling ${sibling.id}: ${err}`);
      }
    }
  }

  /* ────── User Orders ──────────────────────────────── */
  async getUserOrders(
    userId: string,
    symbol?: string,
    status?: OrderStatus,
    limit = 50,
    offset = 0,
  ): Promise<{ orders: Order[]; total: number }> {
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.userId = :userId', { userId })
      .orderBy('o.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    if (symbol) qb.andWhere('o.symbol = :symbol', { symbol });
    if (status) qb.andWhere('o.status = :status', { status });

    const [orders, total] = await qb.getManyAndCount();
    return { orders, total };
  }

  /* ────── Process Matches (Explicit Fee Model) ──────── */

  /**
   * Fee model:
   *   - Buyer  receives base  → fee charged in base  asset
   *   - Seller receives quote → fee charged in quote asset
   *
   * Settlement per trade:
   *   grossBase  = matched quantity
   *   grossQuote = price × grossBase
   *
   *   Buyer:
   *     debit  quote locked:  grossQuote
   *     credit base available: grossBase − buyerFee  (buyerFee in base)
   *
   *   Seller:
   *     debit  base locked:   grossBase
   *     credit quote available: grossQuote − sellerFee  (sellerFee in quote)
   *
   *   Platform treasury:
   *     credit buyerFee  in base  asset
   *     credit sellerFee in quote asset
   */
  private async processMatches(
    matches: MatchResult[],
    pair: TradingPair,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const makerFeeRate = new Decimal(pair.makerFee);
      const takerFeeRate = new Decimal(pair.takerFee);

      for (const m of matches) {
        const grossBase = m.quantity;
        const grossQuote = m.price.times(m.quantity);

        // Determine who is buyer and seller
        const buyerUserId = m.takerSide === 'buy' ? m.takerUserId : m.makerUserId;
        const sellerUserId = m.takerSide === 'sell' ? m.takerUserId : m.makerUserId;

        // Determine maker/taker fee rates for each party
        const buyerIsTaker = m.takerSide === 'buy';
        const buyerRate = buyerIsTaker ? takerFeeRate : makerFeeRate;
        const sellerRate = buyerIsTaker ? makerFeeRate : takerFeeRate;

        // Calculate fees in the asset each party RECEIVES
        const buyerFeeAmount = grossBase.times(buyerRate);   // fee in BASE
        const sellerFeeAmount = grossQuote.times(sellerRate); // fee in QUOTE

        const buyerFeeAsset = pair.baseCurrency;
        const sellerFeeAsset = pair.quoteCurrency;

        // ── Persist trade ──────────────────────────────
        const trade = manager.create(Trade, {
          symbol: m.symbol,
          price: m.price.toFixed(),
          grossBase: grossBase.toFixed(),
          grossQuote: grossQuote.toFixed(),
          buyerFeeAmount: buyerFeeAmount.toFixed(),
          buyerFeeAsset,
          sellerFeeAmount: sellerFeeAmount.toFixed(),
          sellerFeeAsset,
          makerFeeRate: makerFeeRate.toFixed(),
          takerFeeRate: takerFeeRate.toFixed(),
          makerOrderId: m.makerOrderId,
          takerOrderId: m.takerOrderId,
          makerUserId: m.makerUserId,
          takerUserId: m.takerUserId,
          buyerUserId,
          sellerUserId,
          takerSide: m.takerSide,
        });
        const savedTrade = await manager.save(trade);

        // ── Update maker order ──────────────────────────
        const makerOrder = await manager.findOneOrFail(Order, {
          where: { id: m.makerOrderId },
        });
        makerOrder.filledQuantity = new Decimal(makerOrder.filledQuantity)
          .plus(grossBase)
          .toFixed();
        makerOrder.filledQuote = new Decimal(makerOrder.filledQuote)
          .plus(grossQuote)
          .toFixed();
        makerOrder.status = new Decimal(makerOrder.filledQuantity).gte(
          makerOrder.quantity,
        )
          ? OrderStatus.FILLED
          : OrderStatus.PARTIALLY_FILLED;
        await manager.save(makerOrder);

        // ── Update taker order ──────────────────────────
        const takerOrder = await manager.findOneOrFail(Order, {
          where: { id: m.takerOrderId },
        });
        takerOrder.filledQuantity = new Decimal(takerOrder.filledQuantity)
          .plus(grossBase)
          .toFixed();
        takerOrder.filledQuote = new Decimal(takerOrder.filledQuote)
          .plus(grossQuote)
          .toFixed();
        takerOrder.status = new Decimal(takerOrder.filledQuantity).gte(
          takerOrder.quantity,
        )
          ? OrderStatus.FILLED
          : OrderStatus.PARTIALLY_FILLED;
        await manager.save(takerOrder);

        // ── Settle buyer ────────────────────────────────
        // Buyer: debit quote locked, credit base available (net of fee)
        await this.wallets.settleTrade(
          buyerUserId,
          pair.quoteCurrency,
          grossQuote,
          pair.baseCurrency,
          grossBase.minus(buyerFeeAmount), // net base after fee
          manager,
        );

        // ── Settle seller ───────────────────────────────
        // Seller: debit base locked, credit quote available (net of fee)
        await this.wallets.settleTrade(
          sellerUserId,
          pair.baseCurrency,
          grossBase,
          pair.quoteCurrency,
          grossQuote.minus(sellerFeeAmount), // net quote after fee
          manager,
        );

        // ── Credit fees to platform treasury ────────────
        await this.wallets.creditFee(buyerFeeAsset, buyerFeeAmount, manager);
        await this.wallets.creditFee(sellerFeeAsset, sellerFeeAmount, manager);

        // ── Fee ledger entries ──────────────────────────
        if (buyerFeeAmount.gt(0)) {
          const buyerLedger = manager.create(FeeLedger, {
            tradeId: savedTrade.id,
            asset: buyerFeeAsset,
            amount: buyerFeeAmount.toFixed(),
            source: 'buyer_fee',
            userId: buyerUserId,
          });
          await manager.save(buyerLedger);
        }

        if (sellerFeeAmount.gt(0)) {
          const sellerLedger = manager.create(FeeLedger, {
            tradeId: savedTrade.id,
            asset: sellerFeeAsset,
            amount: sellerFeeAmount.toFixed(),
            source: 'seller_fee',
            userId: sellerUserId,
          });
          await manager.save(sellerLedger);
        }

        // ── Cancel OCO siblings on fill ─────────────────────
        if (makerOrder.status === OrderStatus.FILLED && makerOrder.ocoGroupId) {
          this.cancelOcoSibling(makerOrder).catch((err) =>
            this.logger.warn(`OCO sibling cancel failed for maker ${makerOrder.id}: ${err}`),
          );
        }
        if (takerOrder.status === OrderStatus.FILLED && takerOrder.ocoGroupId) {
          this.cancelOcoSibling(takerOrder).catch((err) =>
            this.logger.warn(`OCO sibling cancel failed for taker ${takerOrder.id}: ${err}`),
          );
        }

        // ── Trade fill notifications ─────────────────────
        const tradeNotifMeta = {
          tradeId: savedTrade.id,
          symbol: m.symbol,
          price: m.price.toFixed(),
          quantity: grossBase.toFixed(),
          quoteAmount: grossQuote.toFixed(),
        };

        this.notifications
          .createNotification(
            buyerUserId,
            NotificationType.TRADE_FILL,
            'Order Filled',
            `Your buy order for ${grossBase.toFixed()} ${pair.baseCurrency} at ${m.price.toFixed()} ${pair.quoteCurrency} has been filled.`,
            { ...tradeNotifMeta, side: 'buy' },
          )
          .catch((err) =>
            this.logger.warn(`Failed to create buyer notification: ${err}`),
          );

        this.notifications
          .createNotification(
            sellerUserId,
            NotificationType.TRADE_FILL,
            'Order Filled',
            `Your sell order for ${grossBase.toFixed()} ${pair.baseCurrency} at ${m.price.toFixed()} ${pair.quoteCurrency} has been filled.`,
            { ...tradeNotifMeta, side: 'sell' },
          )
          .catch((err) =>
            this.logger.warn(`Failed to create seller notification: ${err}`),
          );
      }
    });
  }

  /* ────── Handle STP Events ─────────────────────────── */
  private async handleStpEvents(
    stpEvents: StpEvent[],
    takerOrder: Order,
    pair: TradingPair,
  ): Promise<void> {
    for (const stp of stpEvents) {
      if (stp.cancelled === 'taker') {
        // The taker was cancelled — unlock any remaining funds
        const remaining = new Decimal(stp.remainingQty);
        if (remaining.gt(0)) {
          if (takerOrder.side === OrderSide.BUY) {
            const unlockAmount = remaining.times(takerOrder.price);
            await this.wallets.unlockFunds(
              takerOrder.userId,
              pair.quoteCurrency,
              unlockAmount,
            );
          } else {
            await this.wallets.unlockFunds(
              takerOrder.userId,
              pair.baseCurrency,
              remaining,
            );
          }
        }

        // Update taker order status
        const filledQty = new Decimal(takerOrder.quantity).minus(remaining);
        if (filledQty.gt(0)) {
          takerOrder.status = OrderStatus.CANCELLED; // partially filled + cancelled
        } else {
          takerOrder.status = OrderStatus.CANCELLED;
        }
        await this.orderRepo.save(takerOrder);
      } else if (stp.cancelled === 'maker') {
        // The maker was cancelled — update its DB record and unlock funds
        const makerOrder = await this.orderRepo.findOne({
          where: { id: stp.makerOrderId },
        });
        if (makerOrder) {
          const remaining = new Decimal(makerOrder.quantity).minus(makerOrder.filledQuantity);
          if (remaining.gt(0)) {
            if (makerOrder.side === OrderSide.BUY) {
              await this.wallets.unlockFunds(
                makerOrder.userId,
                pair.quoteCurrency,
                remaining.times(makerOrder.price),
              );
            } else {
              await this.wallets.unlockFunds(
                makerOrder.userId,
                pair.baseCurrency,
                remaining,
              );
            }
          }
          makerOrder.status = OrderStatus.CANCELLED;
          await this.orderRepo.save(makerOrder);
        }
      }

      this.logger.warn(
        `STP: ${stp.mode} cancelled ${stp.cancelled} order in ${stp.symbol} for user ${stp.userId}`,
      );
    }
  }

  /* ────── Emit balance updates via WebSocket ──────── */
  private async emitBalanceUpdates(userId: string, pair: TradingPair): Promise<void> {
    try {
      const balances = await this.wallets.getBalances(userId);
      this.events.emit('balance.updated', { userId, balances });
    } catch (err) {
      this.logger.warn(`Failed to emit balance update for ${userId}: ${err}`);
    }
  }
}
