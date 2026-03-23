import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { MarketService, TickerDto, OrderBookDto } from './market.service';
import { TradingPair } from '../trading/entities/trading-pair.entity';
import { OhlcvCandle } from '../../providers/market-data/coingecko.service';

@ApiTags('market')
@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('pairs')
  @ApiOperation({ summary: 'List all active trading pairs' })
  @ApiResponse({ status: 200, description: 'List of trading pairs' })
  async getPairs(): Promise<TradingPair[]> {
    return this.marketService.getPairs();
  }

  @Get('ticker/:pair')
  @ApiOperation({ summary: 'Get 24h ticker for a trading pair' })
  @ApiResponse({ status: 200, description: '24-hour ticker data' })
  @ApiResponse({ status: 404, description: 'Pair not found' })
  async getTicker(@Param('pair') pair: string): Promise<TickerDto> {
    // First try internal data; if no trades exist merge CoinGecko live data
    const internal = await this.marketService.getTicker(pair);

    if (internal.lastPrice !== '0') {
      return { ...internal, source: 'internal' };
    }

    // No internal trades — return live CoinGecko data instead
    return this.marketService.getLiveTicker(pair);
  }

  @Get('candles/:pair')
  @ApiOperation({ summary: 'Get OHLCV candle data for charting' })
  @ApiQuery({
    name: 'timeframe',
    required: false,
    type: String,
    example: '1h',
    description: 'Candle timeframe: 1h, 4h, 1d, 1w, 1M',
  })
  @ApiResponse({ status: 200, description: 'OHLCV candle array' })
  async getCandles(
    @Param('pair') pair: string,
    @Query('timeframe') timeframe?: string,
  ): Promise<OhlcvCandle[]> {
    return this.marketService.getCandles(pair, timeframe ?? '1h');
  }

  @Get('orderbook/:pair')
  @ApiOperation({ summary: 'Get order book snapshot for a trading pair' })
  @ApiQuery({ name: 'depth', required: false, type: Number, example: 50 })
  @ApiResponse({ status: 200, description: 'Order book with bids and asks' })
  async getOrderBook(
    @Param('pair') pair: string,
    @Query('depth') depth?: number,
  ): Promise<OrderBookDto> {
    return this.marketService.getOrderBook(pair, depth ?? 50);
  }
}
