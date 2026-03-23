import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { GridBot, GridOrder, GridType } from './grid-bot.entity';
import { TradingService } from '../trading/trading.service';
import { WalletsService } from '../wallets/wallets.service';

/* ─── DTOs ────────────────────────────────────────── */

export interface CreateGridBotDto {
  symbol: string;
  gridType: GridType;
  lowerPrice: string;
  upperPrice: string;
  gridCount: number;
  totalInvestment: string;
}

export interface GridBotDto {
  id: string;
  userId: string;
  symbol: string;
  status: string;
  gridType: string;
  lowerPrice: string;
  upperPrice: string;
  gridCount: number;
  totalInvestment: string;
  profitPerGrid: string;
  totalProfit: string;
  gridOrders: GridOrder[];
  createdAt: string;
}

@Injectable()
export class BotsService {
  private readonly logger = new Logger(BotsService.name);

  constructor(
    @InjectRepository(GridBot)
    private readonly botRepo: Repository<GridBot>,
    private readonly tradingService: TradingService,
    private readonly walletsService: WalletsService,
  ) {}

  /* ──── Calculate grid price levels ──────────────── */
  calculateGridLevels(
    lower: string,
    upper: string,
    count: number,
    type: GridType,
  ): string[] {
    const lo = new Decimal(lower);
    const hi = new Decimal(upper);
    const levels: string[] = [];

    if (type === 'arithmetic') {
      const step = hi.minus(lo).div(count);
      for (let i = 0; i <= count; i++) {
        levels.push(lo.plus(step.mul(i)).toFixed(8));
      }
    } else {
      // geometric
      const ratio = hi.div(lo).pow(new Decimal(1).div(count));
      for (let i = 0; i <= count; i++) {
        levels.push(lo.mul(ratio.pow(i)).toFixed(8));
      }
    }

    return levels;
  }

  /* ──── Create a grid bot ────────────────────────── */
  async createGridBot(
    userId: string,
    dto: CreateGridBotDto,
  ): Promise<GridBotDto> {
    const lower = new Decimal(dto.lowerPrice);
    const upper = new Decimal(dto.upperPrice);
    const investment = new Decimal(dto.totalInvestment);

    if (lower.gte(upper)) {
      throw new BadRequestException('Lower price must be less than upper price');
    }
    if (dto.gridCount < 5 || dto.gridCount > 200) {
      throw new BadRequestException('Grid count must be between 5 and 200');
    }
    if (investment.lte(0)) {
      throw new BadRequestException('Investment must be positive');
    }

    // Calculate grid levels
    const levels = this.calculateGridLevels(
      dto.lowerPrice,
      dto.upperPrice,
      dto.gridCount,
      dto.gridType,
    );

    // Calculate profit per grid
    const profitPerGrid = upper.minus(lower).div(dto.gridCount);

    // Lock investment funds — lock quote currency (right side of pair, e.g. USDT)
    const quoteCurrency = dto.symbol.replace(/^[A-Z]+/, '').replace(/^\//, '') || 'USDT';
    await this.walletsService.lockFunds(userId, quoteCurrency, investment);

    // Build grid orders (buy orders below mid, sell orders above mid)
    const midPrice = lower.plus(upper).div(2);
    const gridOrders: GridOrder[] = levels.map((price, index) => ({
      level: index,
      price,
      side: new Decimal(price).lte(midPrice) ? 'buy' as const : 'sell' as const,
      orderId: null,
      status: 'pending' as const,
    }));

    // Create bot entity
    const bot = this.botRepo.create({
      userId,
      symbol: dto.symbol,
      status: 'running',
      gridType: dto.gridType,
      lowerPrice: dto.lowerPrice,
      upperPrice: dto.upperPrice,
      gridCount: dto.gridCount,
      totalInvestment: dto.totalInvestment,
      profitPerGrid: profitPerGrid.toFixed(8),
      totalProfit: '0',
      gridOrders,
    });

    const saved = await this.botRepo.save(bot);

    // Place initial grid orders
    for (const gridOrder of saved.gridOrders) {
      try {
        const quantityPerGrid = investment.div(dto.gridCount).div(gridOrder.price);
        const order = await this.tradingService.placeOrder(userId, {
          symbol: dto.symbol,
          side: gridOrder.side,
          type: 'limit',
          price: gridOrder.price,
          quantity: quantityPerGrid.toFixed(8),
        });

        gridOrder.orderId = order.id;
        gridOrder.status = 'placed';
      } catch (err) {
        this.logger.warn(
          `Failed to place grid order at ${gridOrder.price}: ${(err as Error).message}`,
        );
        gridOrder.status = 'pending';
      }
    }

    saved.gridOrders = [...saved.gridOrders];
    await this.botRepo.save(saved);

    this.logger.log(
      `Grid bot created for user ${userId}: ${dto.symbol} [${dto.lowerPrice}-${dto.upperPrice}] x${dto.gridCount}`,
    );

    return this.toBotDto(saved);
  }

  /* ──── Stop a bot ───────────────────────────────── */
  async stopBot(userId: string, botId: string): Promise<GridBotDto> {
    const bot = await this.botRepo.findOne({
      where: { id: botId, userId },
    });

    if (!bot) {
      throw new NotFoundException('Bot not found');
    }

    if (bot.status === 'stopped') {
      throw new BadRequestException('Bot is already stopped');
    }

    // Cancel all placed grid orders
    for (const gridOrder of bot.gridOrders) {
      if (gridOrder.orderId && gridOrder.status === 'placed') {
        try {
          await this.tradingService.cancelOrder(userId, gridOrder.orderId);
          gridOrder.status = 'cancelled';
        } catch (err) {
          this.logger.warn(
            `Failed to cancel grid order ${gridOrder.orderId}: ${(err as Error).message}`,
          );
        }
      }
    }

    // Unlock remaining investment
    const investment = new Decimal(bot.totalInvestment);
    const quoteCurrency = bot.symbol.replace(/^[A-Z]+/, '').replace(/^\//, '') || 'USDT';
    if (investment.gt(0)) {
      try {
        await this.walletsService.unlockFunds(userId, quoteCurrency, investment);
      } catch (err) {
        this.logger.warn(`Failed to unlock funds for bot ${botId}: ${(err as Error).message}`);
      }
    }

    bot.status = 'stopped';
    bot.gridOrders = [...bot.gridOrders];
    const saved = await this.botRepo.save(bot);

    this.logger.log(`Grid bot ${botId} stopped for user ${userId}`);

    return this.toBotDto(saved);
  }

  /* ──── Pause a bot ──────────────────────────────── */
  async pauseBot(userId: string, botId: string): Promise<GridBotDto> {
    const bot = await this.botRepo.findOne({
      where: { id: botId, userId, status: 'running' },
    });

    if (!bot) {
      throw new NotFoundException('Running bot not found');
    }

    bot.status = 'paused';
    const saved = await this.botRepo.save(bot);

    this.logger.log(`Grid bot ${botId} paused for user ${userId}`);

    return this.toBotDto(saved);
  }

  /* ──── Resume a bot ─────────────────────────────── */
  async resumeBot(userId: string, botId: string): Promise<GridBotDto> {
    const bot = await this.botRepo.findOne({
      where: { id: botId, userId, status: 'paused' },
    });

    if (!bot) {
      throw new NotFoundException('Paused bot not found');
    }

    bot.status = 'running';
    const saved = await this.botRepo.save(bot);

    this.logger.log(`Grid bot ${botId} resumed for user ${userId}`);

    return this.toBotDto(saved);
  }

  /* ──── Handle grid order filled ─────────────────── */
  async onGridOrderFilled(botId: string, orderId: string): Promise<void> {
    const bot = await this.botRepo.findOne({ where: { id: botId } });
    if (!bot || bot.status !== 'running') return;

    const filledOrder = bot.gridOrders.find((o) => o.orderId === orderId);
    if (!filledOrder) return;

    filledOrder.status = 'filled';

    // Place counter order at the next grid level
    const filledLevel = filledOrder.level;
    const counterLevel = filledOrder.side === 'buy'
      ? filledLevel + 1
      : filledLevel - 1;

    const counterGrid = bot.gridOrders.find((o) => o.level === counterLevel);
    if (counterGrid && counterGrid.status !== 'placed') {
      const counterSide = filledOrder.side === 'buy' ? 'sell' : 'buy';
      const investment = new Decimal(bot.totalInvestment);
      const quantityPerGrid = investment.div(bot.gridCount).div(counterGrid.price);

      try {
        const order = await this.tradingService.placeOrder(bot.userId, {
          symbol: bot.symbol,
          side: counterSide,
          type: 'limit',
          price: counterGrid.price,
          quantity: quantityPerGrid.toFixed(8),
        });

        counterGrid.orderId = order.id;
        counterGrid.side = counterSide;
        counterGrid.status = 'placed';
      } catch (err) {
        this.logger.warn(
          `Failed to place counter grid order: ${(err as Error).message}`,
        );
      }
    }

    // Update profit
    bot.totalProfit = new Decimal(bot.totalProfit)
      .plus(bot.profitPerGrid)
      .toFixed(8);

    bot.gridOrders = [...bot.gridOrders];
    await this.botRepo.save(bot);

    this.logger.log(
      `Grid order filled for bot ${botId}: level ${filledLevel}, new profit ${bot.totalProfit}`,
    );
  }

  /* ──── Get user's bots ──────────────────────────── */
  async getBots(userId: string): Promise<GridBotDto[]> {
    const bots = await this.botRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return bots.map((b) => this.toBotDto(b));
  }

  /* ──── Map to DTO ───────────────────────────────── */
  private toBotDto(bot: GridBot): GridBotDto {
    return {
      id: bot.id,
      userId: bot.userId,
      symbol: bot.symbol,
      status: bot.status,
      gridType: bot.gridType,
      lowerPrice: bot.lowerPrice,
      upperPrice: bot.upperPrice,
      gridCount: bot.gridCount,
      totalInvestment: bot.totalInvestment,
      profitPerGrid: bot.profitPerGrid,
      totalProfit: bot.totalProfit,
      gridOrders: bot.gridOrders,
      createdAt: bot.createdAt.toISOString(),
    };
  }
}
