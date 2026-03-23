import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import Decimal from 'decimal.js';
import { MatchResult } from '../trading/matching-engine.service';
import { MatchingEngineService } from '../trading/matching-engine.service';
import { TradingService } from '../trading/trading.service';
import { CoinGeckoService } from '../../providers/market-data/coingecko.service';
import { WsRateLimiter } from '../../common/rate-limit/ws-rate-limit';
import { AlertsService } from '../alerts/alerts.service';

/**
 * Unified WebSocket gateway for public market data and private user streams.
 *
 * Public rooms (no auth): {symbol}:ticker, {symbol}:trades, {symbol}:orderbook
 * Private rooms (auth):   user:{userId}  (order updates, balance changes, fills)
 *
 * Sequence numbers: every event includes a monotonically increasing `seq` field
 * per room, so clients can detect gaps and request re-sync.
 */
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/ws/market',
})
export class MarketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MarketGateway.name);

  /** Per-room sequence counters for gap detection */
  private readonly seqCounters = new Map<string, number>();

  /** WebSocket rate limiter for connection and message throttling */
  private readonly wsRateLimiter = new WsRateLimiter();

  /** Interval handle for CoinGecko stop-order polling */
  private stopCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly engine: MatchingEngineService,
    private readonly tradingService: TradingService,
    private readonly coinGeckoService: CoinGeckoService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly alertsService: AlertsService,
  ) {}

  onModuleInit(): void {
    // Poll CoinGecko every 30s to check stop-limit orders for symbols
    // that have no internal trade activity
    this.stopCheckInterval = setInterval(() => {
      this.pollCoinGeckoForStopOrders().catch((err) =>
        this.logger.warn(`CoinGecko stop-order poll failed: ${err}`),
      );
    }, 30_000);
  }

  onModuleDestroy(): void {
    if (this.stopCheckInterval) {
      clearInterval(this.stopCheckInterval);
      this.stopCheckInterval = null;
    }
  }

  afterInit(): void {
    this.logger.log('WebSocket gateway initialized (public + private streams)');
  }

  /* ─── Connection lifecycle ─────────────────────────── */

  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected: ${client.id}`);

    // ── Rate limit: check per-IP connection count ──────
    const ip =
      (client.handshake.headers['x-forwarded-for'] as string)
        ?.split(',')[0]
        ?.trim() ||
      client.handshake.address ||
      'unknown';

    if (!this.wsRateLimiter.onConnect(client.id, ip)) {
      client.emit('error', WsRateLimiter.connectionLimitError());
      client.disconnect(true);
      return;
    }

    // Attempt JWT auth from handshake
    const token =
      client.handshake.auth?.token ??
      client.handshake.headers?.authorization?.replace('Bearer ', '');

    if (token) {
      try {
        const payload = this.jwtService.verify(token, {
          secret: this.configService.get<string>('jwt.secret', 'change-me'),
        });
        if (payload.type === 'access' && payload.sub) {
          (client as any).userId = payload.sub;
          // Auto-join private room
          client.join(`user:${payload.sub}`);
          client.emit('authenticated', { userId: payload.sub });
          this.logger.debug(`Client ${client.id} authenticated as ${payload.sub}`);
        }
      } catch {
        this.logger.debug(`Client ${client.id} token invalid — public-only`);
      }
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
    this.wsRateLimiter.onDisconnect(client.id);
  }

  /* ─── Authenticate after connect ───────────────────── */

  @SubscribeMessage('authenticate')
  handleAuthenticate(
    @MessageBody() data: { token: string },
    @ConnectedSocket() client: Socket,
  ): void {
    // ── Rate limit: count as a message ─────────────────
    if (!this.wsRateLimiter.onMessage(client.id)) {
      client.emit('error', WsRateLimiter.messageLimitError());
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify(data.token, {
        secret: this.configService.get<string>('jwt.secret', 'change-me'),
      });
      if (payload.type === 'access' && payload.sub) {
        (client as any).userId = payload.sub;
        client.join(`user:${payload.sub}`);
        client.emit('authenticated', { userId: payload.sub });
        this.logger.debug(`Client ${client.id} authenticated as ${payload.sub}`);
      } else {
        client.emit('auth_error', { message: 'Invalid token type' });
      }
    } catch {
      client.emit('auth_error', { message: 'Invalid or expired token' });
    }
  }

  /* ─── Public channel subscriptions ─────────────────── */

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: { symbol: string; channels: string[] },
    @ConnectedSocket() client: Socket,
  ): void {
    // ── Rate limit: count as both message and subscribe ─
    if (!this.wsRateLimiter.onMessage(client.id)) {
      client.emit('error', WsRateLimiter.messageLimitError());
      client.disconnect(true);
      return;
    }
    if (!this.wsRateLimiter.onSubscribe(client.id)) {
      client.emit('error', WsRateLimiter.subscribeLimitError());
      client.disconnect(true);
      return;
    }

    const { symbol, channels } = data;

    for (const channel of channels) {
      const room = `${symbol}:${channel}`;
      client.join(room);
    }

    // Send initial orderbook snapshot
    if (channels.includes('orderbook')) {
      const book = this.engine.getOrderBook(symbol, 50);
      client.emit('orderbook:snapshot', {
        symbol,
        ...book,
        seq: this.nextSeq(`${symbol}:orderbook`),
        timestamp: Date.now(),
      });
    }

    client.emit('subscribed', { symbol, channels });
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: { symbol: string; channels: string[] },
    @ConnectedSocket() client: Socket,
  ): void {
    // ── Rate limit: count as a message ─────────────────
    if (!this.wsRateLimiter.onMessage(client.id)) {
      client.emit('error', WsRateLimiter.messageLimitError());
      client.disconnect(true);
      return;
    }

    for (const channel of data.channels) {
      client.leave(`${data.symbol}:${channel}`);
    }
    client.emit('unsubscribed', data);
  }

  /* ─── Trade event handler (from matching engine) ────── */

  @OnEvent('trade.executed')
  handleTradeExecuted(trade: MatchResult): void {
    const { symbol } = trade;
    const ts = Date.now();

    // ── Public: trade stream ──────────────────────────
    this.server.to(`${symbol}:trades`).emit('trade', {
      symbol,
      price: trade.price.toFixed(),
      quantity: trade.quantity.toFixed(),
      takerSide: trade.takerSide,
      seq: this.nextSeq(`${symbol}:trades`),
      timestamp: ts,
    });

    // ── Public: ticker update ─────────────────────────
    this.server.to(`${symbol}:ticker`).emit('ticker:update', {
      symbol,
      lastPrice: trade.price.toFixed(),
      seq: this.nextSeq(`${symbol}:ticker`),
      timestamp: ts,
    });

    // ── Public: orderbook snapshot ────────────────────
    const book = this.engine.getOrderBook(symbol, 50);
    this.server.to(`${symbol}:orderbook`).emit('orderbook:update', {
      symbol,
      bids: book.bids,
      asks: book.asks,
      seq: this.nextSeq(`${symbol}:orderbook`),
      timestamp: ts,
    });

    // ── Private: fill notifications to both parties ───
    const fillPayload = {
      type: 'fill',
      symbol,
      price: trade.price.toFixed(),
      quantity: trade.quantity.toFixed(),
      takerSide: trade.takerSide,
      makerOrderId: trade.makerOrderId,
      takerOrderId: trade.takerOrderId,
      timestamp: ts,
    };

    this.server.to(`user:${trade.makerUserId}`).emit('account:fill', {
      ...fillPayload,
      role: 'maker',
      orderId: trade.makerOrderId,
      seq: this.nextSeq(`user:${trade.makerUserId}`),
    });
    this.server.to(`user:${trade.takerUserId}`).emit('account:fill', {
      ...fillPayload,
      role: 'taker',
      orderId: trade.takerOrderId,
      seq: this.nextSeq(`user:${trade.takerUserId}`),
    });

    // ── Check stop-limit orders against the trade price ──
    this.tradingService
      .checkStopOrders(symbol, trade.price)
      .catch((err) =>
        this.logger.warn(`Stop order check failed after trade in ${symbol}: ${err}`),
      );

    // ── Check price alerts against the trade price ──
    this.alertsService
      .checkAlerts(symbol, trade.price)
      .catch((err) =>
        this.logger.warn(`Alert check failed after trade in ${symbol}: ${err}`),
      );
  }

  /* ─── Order status events (emitted by TradingService) ── */

  @OnEvent('order.placed')
  handleOrderPlaced(data: { userId: string; order: any }): void {
    this.server.to(`user:${data.userId}`).emit('account:order', {
      type: 'placed',
      order: data.order,
      seq: this.nextSeq(`user:${data.userId}`),
      timestamp: Date.now(),
    });
  }

  @OnEvent('order.cancelled')
  handleOrderCancelled(data: { userId: string; order: any }): void {
    this.server.to(`user:${data.userId}`).emit('account:order', {
      type: 'cancelled',
      order: data.order,
      seq: this.nextSeq(`user:${data.userId}`),
      timestamp: Date.now(),
    });
  }

  @OnEvent('balance.updated')
  handleBalanceUpdated(data: { userId: string; balances: any[] }): void {
    this.server.to(`user:${data.userId}`).emit('account:balance', {
      type: 'balance_update',
      balances: data.balances,
      seq: this.nextSeq(`user:${data.userId}`),
      timestamp: Date.now(),
    });
  }

  /* ─── CoinGecko stop-order polling ───────────────── */

  /**
   * Fetches latest CoinGecko prices and runs stop-order checks
   * for all supported symbols. This ensures stop-limit orders
   * can trigger even when there is no internal trade activity.
   */
  private async pollCoinGeckoForStopOrders(): Promise<void> {
    const tickers = await this.coinGeckoService.getTickers();
    for (const [symbol, ticker] of tickers) {
      // Convert CoinGecko symbol (e.g. BTCUSDT) to NovEx pair format if needed
      // CoinGecko service already uses NovEx symbols as keys
      const lastPrice = new Decimal(ticker.price);
      if (lastPrice.gt(0)) {
        await this.tradingService.checkStopOrders(symbol, lastPrice);
        await this.alertsService.checkAlerts(symbol, lastPrice);
      }
    }
  }

  /* ─── Sequence counter ─────────────────────────────── */

  private nextSeq(room: string): number {
    const current = this.seqCounters.get(room) ?? 0;
    const next = current + 1;
    this.seqCounters.set(room, next);
    return next;
  }
}
