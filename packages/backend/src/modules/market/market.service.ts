import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { TradingPair } from '../trading/entities/trading-pair.entity';
import { Trade } from '../trading/entities/trade.entity';
import { MatchingEngineService } from '../trading/matching-engine.service';
import {
  CoinGeckoService,
  OhlcvCandle,
} from '../../providers/market-data/coingecko.service';

export interface TickerDto {
  symbol: string;
  lastPrice: string;
  highPrice24h: string;
  lowPrice24h: string;
  volume24h: string;
  quoteVolume24h: string;
  priceChangePercent24h: string;
  source?: 'internal' | 'coingecko';
}

export interface OrderBookDto {
  symbol: string;
  bids: [string, string][];
  asks: [string, string][];
  timestamp: number;
}

/** Map CoinGecko timeframe strings to OHLC `days` param. */
const TIMEFRAME_TO_DAYS: Record<string, number> = {
  '1h': 1,
  '4h': 1,
  '1d': 30,
  '1w': 180,
  '1M': 365,
};

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);

  constructor(
    @InjectRepository(TradingPair)
    private readonly pairRepo: Repository<TradingPair>,
    @InjectRepository(Trade)
    private readonly tradeRepo: Repository<Trade>,
    private readonly engine: MatchingEngineService,
    private readonly coinGecko: CoinGeckoService,
  ) {}

  /* ─── All active pairs ─────────────────────────────── */
  async getPairs(): Promise<TradingPair[]> {
    return this.pairRepo.find({ where: { isActive: true } });
  }

  /* ─── 24h Ticker ───────────────────────────────────── */
  async getTicker(symbol: string): Promise<TickerDto> {
    const pair = await this.pairRepo.findOne({
      where: { symbol, isActive: true },
    });
    if (!pair) throw new NotFoundException(`Pair ${symbol} not found`);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const trades = await this.tradeRepo
      .createQueryBuilder('t')
      .where('t.symbol = :symbol', { symbol })
      .andWhere('t.created_at >= :since', { since })
      .orderBy('t.created_at', 'DESC')
      .getMany();

    if (trades.length === 0) {
      return {
        symbol,
        lastPrice: '0',
        highPrice24h: '0',
        lowPrice24h: '0',
        volume24h: '0',
        quoteVolume24h: '0',
        priceChangePercent24h: '0',
      };
    }

    let high = new Decimal(trades[0].price);
    let low = new Decimal(trades[0].price);
    let volume = new Decimal(0);
    let quoteVolume = new Decimal(0);

    for (const t of trades) {
      const p = new Decimal(t.price);
      const q = new Decimal(t.grossBase);
      if (p.gt(high)) high = p;
      if (p.lt(low)) low = p;
      volume = volume.plus(q);
      quoteVolume = quoteVolume.plus(new Decimal(t.grossQuote));
    }

    const lastPrice = new Decimal(trades[0].price);
    const oldestPrice = new Decimal(trades[trades.length - 1].price);
    const changePercent = oldestPrice.isZero()
      ? new Decimal(0)
      : lastPrice.minus(oldestPrice).div(oldestPrice).times(100);

    return {
      symbol,
      lastPrice: lastPrice.toFixed(),
      highPrice24h: high.toFixed(),
      lowPrice24h: low.toFixed(),
      volume24h: volume.toFixed(),
      quoteVolume24h: quoteVolume.toFixed(),
      priceChangePercent24h: changePercent.toDecimalPlaces(2).toFixed(),
    };
  }

  /* ─── Order book snapshot ──────────────────────────── */
  async getOrderBook(symbol: string, depth = 50): Promise<OrderBookDto> {
    const pair = await this.pairRepo.findOne({
      where: { symbol, isActive: true },
    });
    if (!pair) throw new NotFoundException(`Pair ${symbol} not found`);

    const book = this.engine.getOrderBook(symbol, depth);

    return {
      symbol,
      bids: book.bids,
      asks: book.asks,
      timestamp: Date.now(),
    };
  }

  /* ─── Live ticker (CoinGecko) ────────────────────────── */

  /**
   * Returns real-time ticker data from CoinGecko for a supported symbol.
   * Falls back to the internal ticker when the symbol is not mapped or
   * CoinGecko data is unavailable.
   */
  async getLiveTicker(symbol: string): Promise<TickerDto> {
    const cgTicker = await this.coinGecko.getTickerBySymbol(symbol);

    if (cgTicker) {
      return {
        symbol,
        lastPrice: cgTicker.price.toString(),
        highPrice24h: cgTicker.high24h.toString(),
        lowPrice24h: cgTicker.low24h.toString(),
        volume24h: cgTicker.volume24h.toString(),
        quoteVolume24h: '0',
        priceChangePercent24h: cgTicker.priceChangePercent24h.toFixed(2),
        source: 'coingecko',
      };
    }

    // Unsupported symbol — fall back to internal data
    return this.getTicker(symbol);
  }

  /* ─── OHLCV candle data (CoinGecko) ─────────────────── */

  /**
   * Returns OHLCV candles for charting.
   *
   * @param symbol    NovEx pair, e.g. "BTCUSDT"
   * @param timeframe One of: 1h, 4h, 1d, 1w, 1M
   */
  async getCandles(
    symbol: string,
    timeframe: string = '1h',
  ): Promise<OhlcvCandle[]> {
    const days = TIMEFRAME_TO_DAYS[timeframe] ?? 1;
    return this.coinGecko.getOhlc(symbol, days);
  }
}
