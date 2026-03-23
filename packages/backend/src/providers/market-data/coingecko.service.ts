import { Injectable, Logger } from '@nestjs/common';

/**
 * CoinGecko Market Data Service
 *
 * Fetches live market data from CoinGecko's free public API (v3).
 * Includes a 30-second in-memory cache to respect the free-tier rate limit
 * (~10-30 requests/minute). On error the service returns the last cached
 * value so callers always get a response.
 */

export interface CoinGeckoTicker {
  symbol: string;
  price: number;
  priceChangePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  lastUpdated: number;
}

export interface OhlcvCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const SYMBOL_TO_COINGECKO: Record<string, string> = {
  // ── Original pairs ─────────────────────────────────
  BTCUSDT: 'bitcoin',
  ETHUSDT: 'ethereum',
  SOLUSDT: 'solana',
  DOGEUSDT: 'dogecoin',
  ADAUSDT: 'cardano',
  DOTUSDT: 'polkadot',
  AVAXUSDT: 'avalanche-2',
  LINKUSDT: 'chainlink',
  MATICUSDT: 'matic-network',
  UNIUSDT: 'uniswap',
  XRPUSDT: 'ripple',

  // ── Extended pairs ─────────────────────────────────
  AAVEUSDT: 'aave',
  ALGOUSDT: 'algorand',
  APEUSDT: 'apecoin',
  APTUSDT: 'aptos',
  ARBUSDT: 'arbitrum',
  ATOMUSDT: 'cosmos',
  BNBUSDT: 'binancecoin',
  COMPUSDT: 'compound-governance-token',
  CRVUSDT: 'curve-dao-token',
  DASHUSDT: 'dash',
  EOSUSDT: 'eos',
  ETCUSDT: 'ethereum-classic',
  FILUSDT: 'filecoin',
  FTMUSDT: 'fantom',
  GALAUSDT: 'gala',
  GMXUSDT: 'gmx',
  GRTUSDT: 'the-graph',
  HBARUSDT: 'hedera-hashgraph',
  ICPUSDT: 'internet-computer',
  IMXUSDT: 'immutable-x',
  INJUSDT: 'injective-protocol',
  LDOUSDT: 'lido-dao',
  LTCUSDT: 'litecoin',
  MANAUSDT: 'decentraland',
  MKRUSDT: 'maker',
  NEARUSDT: 'near',
  OPUSDT: 'optimism',
  PEPEUSDT: 'pepe',
  QNTUSDT: 'quant-network',
  RENDERUSDT: 'render-token',
  RUNEUSDT: 'thorchain',
  SANDUSDT: 'the-sandbox',
  SHIBUSDT: 'shiba-inu',
  SNXUSDT: 'havven',
  STXUSDT: 'blockstack',
  SUIUSDT: 'sui',
  SUSHIUSDT: 'sushi',
  THETAUSDT: 'theta-token',
  TIAUSDT: 'celestia',
  TRXUSDT: 'tron',
  VETUSDT: 'vechain',
  WLDUSDT: 'worldcoin-wld',
  XLMUSDT: 'stellar',
  XTZUSDT: 'tezos',
  YFIUSDT: 'yearn-finance',
  ZECUSDT: 'zcash',
  ZILUSDT: 'zilliqa',
};

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

/** Cache TTL in milliseconds (30 s). */
const CACHE_TTL_MS = 30_000;

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

@Injectable()
export class CoinGeckoService {
  private readonly logger = new Logger(CoinGeckoService.name);

  /* ── In-memory caches ────────────────────────────────── */
  private tickerCache: CacheEntry<Map<string, CoinGeckoTicker>> | null = null;
  private readonly ohlcCache = new Map<string, CacheEntry<OhlcvCandle[]>>();
  private readonly chartCache = new Map<string, CacheEntry<OhlcvCandle[]>>();

  /* ─── Helpers ────────────────────────────────────────── */

  /** Map a NovEx trading-pair symbol to a CoinGecko coin id. */
  resolveId(symbol: string): string | undefined {
    return SYMBOL_TO_COINGECKO[symbol.toUpperCase()];
  }

  /** All supported NovEx symbols. */
  supportedSymbols(): string[] {
    return Object.keys(SYMBOL_TO_COINGECKO);
  }

  /* ─── Ticker (batch) ─────────────────────────────────── */

  /**
   * Returns ticker data for all supported coins in a single API call.
   * Uses CoinGecko `/simple/price` with extras.
   */
  async getTickers(): Promise<Map<string, CoinGeckoTicker>> {
    if (this.tickerCache && Date.now() - this.tickerCache.fetchedAt < CACHE_TTL_MS) {
      return this.tickerCache.data;
    }

    const ids = Object.values(SYMBOL_TO_COINGECKO).join(',');
    const url =
      `${COINGECKO_BASE}/simple/price?ids=${ids}` +
      `&vs_currencies=usd` +
      `&include_24hr_change=true` +
      `&include_24hr_vol=true` +
      `&include_last_updated_at=true`;

    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        this.logger.warn(`CoinGecko /simple/price responded ${res.status}`);
        return this.tickerCache?.data ?? new Map();
      }

      const json = await res.json();
      const map = new Map<string, CoinGeckoTicker>();

      for (const [symbol, cgId] of Object.entries(SYMBOL_TO_COINGECKO)) {
        const coin = json[cgId];
        if (!coin) continue;
        map.set(symbol, {
          symbol,
          price: coin.usd ?? 0,
          priceChangePercent24h: coin.usd_24h_change ?? 0,
          volume24h: coin.usd_24h_vol ?? 0,
          high24h: 0,   // not available from /simple/price
          low24h: 0,    // not available from /simple/price
          lastUpdated: (coin.last_updated_at ?? 0) * 1000,
        });
      }

      this.tickerCache = { data: map, fetchedAt: Date.now() };
      return map;
    } catch (err) {
      this.logger.error(`CoinGecko ticker fetch failed: ${(err as Error).message}`);
      return this.tickerCache?.data ?? new Map();
    }
  }

  /**
   * Convenience: ticker for a single symbol.
   */
  async getTickerBySymbol(symbol: string): Promise<CoinGeckoTicker | null> {
    const tickers = await this.getTickers();
    return tickers.get(symbol.toUpperCase()) ?? null;
  }

  /* ─── OHLC candles ───────────────────────────────────── */

  /**
   * Fetch OHLCV candle data from CoinGecko `/coins/{id}/ohlc`.
   *
   * CoinGecko returns [timestamp, open, high, low, close] arrays.
   * Volume is not included in the ohlc endpoint, so we set it to 0
   * unless we can cross-reference with `/market_chart`.
   *
   * @param symbol  NovEx pair symbol, e.g. "BTCUSDT"
   * @param days    Lookback: 1, 7, 14, 30, 90, 180, 365, or "max"
   */
  async getOhlc(symbol: string, days: number | string = 1): Promise<OhlcvCandle[]> {
    const cgId = this.resolveId(symbol);
    if (!cgId) return [];

    const cacheKey = `${cgId}:${days}`;
    const cached = this.ohlcCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.data;
    }

    const url = `${COINGECKO_BASE}/coins/${cgId}/ohlc?vs_currency=usd&days=${days}`;

    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        this.logger.warn(`CoinGecko /ohlc responded ${res.status} for ${cgId}`);
        return cached?.data ?? [];
      }

      const json: number[][] = await res.json();

      const candles: OhlcvCandle[] = json.map(([ts, o, h, l, c]) => ({
        timestamp: ts,
        open: o,
        high: h,
        low: l,
        close: c,
        volume: 0, // ohlc endpoint does not include volume
      }));

      this.ohlcCache.set(cacheKey, { data: candles, fetchedAt: Date.now() });
      return candles;
    } catch (err) {
      this.logger.error(`CoinGecko OHLC fetch failed (${cgId}): ${(err as Error).message}`);
      return cached?.data ?? [];
    }
  }

  /* ─── Market chart (prices + volumes) ────────────────── */

  /**
   * Fetch detailed price + volume history from `/coins/{id}/market_chart`.
   * Returns synthesised OHLCV candles (open=close=price for each point,
   * volume from the volume series).
   *
   * Useful when you need volume data that `/ohlc` does not provide.
   */
  async getMarketChart(symbol: string, days: number | string = 1): Promise<OhlcvCandle[]> {
    const cgId = this.resolveId(symbol);
    if (!cgId) return [];

    const cacheKey = `${cgId}:chart:${days}`;
    const cached = this.chartCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.data;
    }

    const url =
      `${COINGECKO_BASE}/coins/${cgId}/market_chart?vs_currency=usd&days=${days}`;

    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        this.logger.warn(`CoinGecko /market_chart responded ${res.status} for ${cgId}`);
        return cached?.data ?? [];
      }

      const json: {
        prices: [number, number][];
        total_volumes: [number, number][];
      } = await res.json();

      // Build a volume lookup by timestamp (timestamps may not align exactly)
      const volumeMap = new Map<number, number>();
      for (const [ts, vol] of json.total_volumes) {
        volumeMap.set(ts, vol);
      }

      const candles: OhlcvCandle[] = json.prices.map(([ts, price]) => ({
        timestamp: ts,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: volumeMap.get(ts) ?? 0,
      }));

      this.chartCache.set(cacheKey, { data: candles, fetchedAt: Date.now() });
      return candles;
    } catch (err) {
      this.logger.error(`CoinGecko market_chart failed (${cgId}): ${(err as Error).message}`);
      return cached?.data ?? [];
    }
  }
}
