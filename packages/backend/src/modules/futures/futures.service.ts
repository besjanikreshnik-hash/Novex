import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { FuturesContract } from './futures-contract.entity';
import { FuturesPosition, PositionSide, PositionStatus } from './futures-position.entity';
import { FuturesOrder, FuturesOrderStatus } from './futures-order.entity';
import { WalletsService } from '../wallets/wallets.service';

export interface OpenPositionDto {
  symbol: string;
  side: 'long' | 'short';
  leverage: number;
  margin: string;
  entryPrice: string;
}

export interface AdjustLeverageDto {
  leverage: number;
}

export interface SetSlTpDto {
  stopLoss?: string | null;
  takeProfit?: string | null;
}

@Injectable()
export class FuturesService {
  private readonly logger = new Logger(FuturesService.name);

  constructor(
    @InjectRepository(FuturesContract)
    private readonly contractRepo: Repository<FuturesContract>,
    @InjectRepository(FuturesPosition)
    private readonly positionRepo: Repository<FuturesPosition>,
    @InjectRepository(FuturesOrder)
    private readonly orderRepo: Repository<FuturesOrder>,
    private readonly walletsService: WalletsService,
  ) {}

  /* ──── List active perpetual contracts ──────────────── */
  async getContracts(): Promise<FuturesContract[]> {
    return this.contractRepo.find({
      where: { isActive: true },
      order: { symbol: 'ASC' },
    });
  }

  /* ──── Open a position ──────────────────────────────── */
  async openPosition(userId: string, dto: OpenPositionDto): Promise<FuturesPosition> {
    // Validate contract exists and is active
    const contract = await this.contractRepo.findOne({
      where: { symbol: dto.symbol, isActive: true },
    });
    if (!contract) {
      throw new NotFoundException(`Futures contract ${dto.symbol} not found or inactive`);
    }

    // Validate leverage
    if (dto.leverage < 1 || dto.leverage > contract.maxLeverage) {
      throw new BadRequestException(
        `Leverage must be between 1x and ${contract.maxLeverage}x for ${dto.symbol}`,
      );
    }

    const margin = new Decimal(dto.margin);
    if (margin.lte(0)) {
      throw new BadRequestException('Margin must be positive');
    }

    const entryPrice = new Decimal(dto.entryPrice);
    if (entryPrice.lte(0)) {
      throw new BadRequestException('Entry price must be positive');
    }

    // Lock margin from user's USDT wallet
    await this.walletsService.lockFunds(userId, 'USDT', margin);

    // Calculate position size: margin * leverage / entryPrice
    const quantity = margin.mul(dto.leverage).div(entryPrice);

    // Calculate liquidation price
    const liquidationPrice = this.calculateLiquidationPrice(
      entryPrice,
      dto.leverage,
      dto.side as PositionSide,
    );

    const position = this.positionRepo.create({
      userId,
      symbol: dto.symbol,
      side: dto.side as PositionSide,
      leverage: dto.leverage,
      entryPrice: entryPrice.toFixed(),
      markPrice: entryPrice.toFixed(),
      quantity: quantity.toFixed(),
      margin: margin.toFixed(),
      unrealizedPnl: '0',
      realizedPnl: '0',
      liquidationPrice: liquidationPrice.toFixed(),
      status: PositionStatus.OPEN,
      stopLoss: null,
      takeProfit: null,
      closedAt: null,
    });

    const saved = await this.positionRepo.save(position);
    this.logger.log(
      `Position opened: ${dto.side} ${dto.symbol} ${quantity.toFixed()} @ ${entryPrice.toFixed()} (${dto.leverage}x) for user ${userId}`,
    );
    return saved;
  }

  /* ──── Close a position ─────────────────────────────── */
  async closePosition(userId: string, positionId: string): Promise<FuturesPosition> {
    const position = await this.positionRepo.findOne({
      where: { id: positionId, userId, status: PositionStatus.OPEN },
    });
    if (!position) {
      throw new NotFoundException('Open position not found');
    }

    // Use current mark price from contract for PnL calculation
    const contract = await this.contractRepo.findOne({
      where: { symbol: position.symbol },
    });
    const markPrice = contract
      ? new Decimal(contract.markPrice)
      : new Decimal(position.entryPrice);

    const pnl = this.calculateUnrealizedPnl(position, markPrice);
    const margin = new Decimal(position.margin);
    const returnAmount = margin.plus(pnl);

    // Return margin + PnL to user's wallet (unlock margin, then credit/debit PnL)
    await this.walletsService.unlockFunds(userId, 'USDT', margin);

    if (pnl.gt(0)) {
      // Credit profits — get or create wallet and add to available
      const wallet = await this.walletsService.getOrCreate(userId, 'USDT');
      wallet.available = new Decimal(wallet.available).plus(pnl).toFixed();
      // Save via the lock/unlock pattern would be complex, so we use direct approach
      // For a production system, this would use a transaction manager
    } else if (pnl.lt(0)) {
      // Deduct losses from available balance
      const wallet = await this.walletsService.getOrCreate(userId, 'USDT');
      const newAvailable = new Decimal(wallet.available).plus(pnl);
      wallet.available = Decimal.max(newAvailable, new Decimal(0)).toFixed();
    }

    position.realizedPnl = pnl.toFixed();
    position.unrealizedPnl = '0';
    position.markPrice = markPrice.toFixed();
    position.status = PositionStatus.CLOSED;
    position.closedAt = new Date();

    const saved = await this.positionRepo.save(position);
    this.logger.log(
      `Position closed: ${position.side} ${position.symbol} PnL: ${pnl.toFixed()} for user ${userId}`,
    );
    return saved;
  }

  /* ──── Adjust leverage on an open position ──────────── */
  async adjustLeverage(
    userId: string,
    positionId: string,
    newLeverage: number,
  ): Promise<FuturesPosition> {
    const position = await this.positionRepo.findOne({
      where: { id: positionId, userId, status: PositionStatus.OPEN },
    });
    if (!position) {
      throw new NotFoundException('Open position not found');
    }

    const contract = await this.contractRepo.findOne({
      where: { symbol: position.symbol },
    });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (newLeverage < 1 || newLeverage > contract.maxLeverage) {
      throw new BadRequestException(
        `Leverage must be between 1x and ${contract.maxLeverage}x`,
      );
    }

    position.leverage = newLeverage;

    // Recalculate liquidation price with new leverage
    const entryPrice = new Decimal(position.entryPrice);
    position.liquidationPrice = this.calculateLiquidationPrice(
      entryPrice,
      newLeverage,
      position.side,
    ).toFixed();

    return this.positionRepo.save(position);
  }

  /* ──── Set stop loss ────────────────────────────────── */
  async setStopLoss(
    userId: string,
    positionId: string,
    price: string | null,
  ): Promise<FuturesPosition> {
    const position = await this.positionRepo.findOne({
      where: { id: positionId, userId, status: PositionStatus.OPEN },
    });
    if (!position) {
      throw new NotFoundException('Open position not found');
    }

    position.stopLoss = price;
    return this.positionRepo.save(position);
  }

  /* ──── Set take profit ──────────────────────────────── */
  async setTakeProfit(
    userId: string,
    positionId: string,
    price: string | null,
  ): Promise<FuturesPosition> {
    const position = await this.positionRepo.findOne({
      where: { id: positionId, userId, status: PositionStatus.OPEN },
    });
    if (!position) {
      throw new NotFoundException('Open position not found');
    }

    position.takeProfit = price;
    return this.positionRepo.save(position);
  }

  /* ──── Calculate liquidation price ──────────────────── */
  calculateLiquidationPrice(
    entryPrice: Decimal,
    leverage: number,
    side: PositionSide,
  ): Decimal {
    // Liquidation price formula:
    // Long: entryPrice * (1 - 1/leverage + maintenanceMarginRate)
    // Short: entryPrice * (1 + 1/leverage - maintenanceMarginRate)
    const maintenanceRate = new Decimal('0.005');
    const leverageDec = new Decimal(leverage);

    if (side === PositionSide.LONG) {
      return entryPrice.mul(
        new Decimal(1).minus(new Decimal(1).div(leverageDec)).plus(maintenanceRate),
      );
    } else {
      return entryPrice.mul(
        new Decimal(1).plus(new Decimal(1).div(leverageDec)).minus(maintenanceRate),
      );
    }
  }

  /* ──── Calculate unrealized PnL ─────────────────────── */
  calculateUnrealizedPnl(position: FuturesPosition, markPrice: Decimal): Decimal {
    const entryPrice = new Decimal(position.entryPrice);
    const quantity = new Decimal(position.quantity);

    if (position.side === PositionSide.LONG) {
      return markPrice.minus(entryPrice).mul(quantity);
    } else {
      return entryPrice.minus(markPrice).mul(quantity);
    }
  }

  /* ──── Get user's positions ─────────────────────────── */
  async getPositions(userId: string): Promise<FuturesPosition[]> {
    const positions = await this.positionRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    // Update unrealized PnL for open positions using latest mark prices
    for (const pos of positions) {
      if (pos.status === PositionStatus.OPEN) {
        const contract = await this.contractRepo.findOne({
          where: { symbol: pos.symbol },
        });
        if (contract) {
          const markPrice = new Decimal(contract.markPrice);
          pos.unrealizedPnl = this.calculateUnrealizedPnl(pos, markPrice).toFixed();
          pos.markPrice = contract.markPrice;
        }
      }
    }

    return positions;
  }
}
