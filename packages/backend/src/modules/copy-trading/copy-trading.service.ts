import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { TraderProfile } from './trader-profile.entity';
import { CopyRelationship } from './copy-relationship.entity';
import { TradingService } from '../trading/trading.service';
import { WalletsService } from '../wallets/wallets.service';

/* ─── DTOs ────────────────────────────────────────── */

export interface TraderProfileDto {
  id: string;
  userId: string;
  displayName: string;
  bio: string;
  totalFollowers: number;
  totalCopiers: number;
  winRate: string;
  totalPnl: string;
  avgReturnPercent: string;
  isPublic: boolean;
  createdAt: string;
}

export interface CopyRelationshipDto {
  id: string;
  copierId: string;
  traderId: string;
  traderDisplayName: string;
  allocationAmount: string;
  maxPositionSize: string;
  status: string;
  totalCopiedTrades: number;
  totalPnl: string;
  createdAt: string;
}

@Injectable()
export class CopyTradingService {
  private readonly logger = new Logger(CopyTradingService.name);

  constructor(
    @InjectRepository(TraderProfile)
    private readonly profileRepo: Repository<TraderProfile>,
    @InjectRepository(CopyRelationship)
    private readonly copyRepo: Repository<CopyRelationship>,
    private readonly tradingService: TradingService,
    private readonly walletsService: WalletsService,
  ) {}

  /* ──── Top traders ranked by PnL ─────────────────── */
  async getTopTraders(limit = 20): Promise<TraderProfileDto[]> {
    const profiles = await this.profileRepo.find({
      where: { isPublic: true },
      order: { totalPnl: 'DESC' },
      take: limit,
    });

    return profiles.map((p) => this.toProfileDto(p));
  }

  /* ──── Get a single trader profile ───────────────── */
  async getTraderProfile(userId: string): Promise<TraderProfileDto> {
    const profile = await this.profileRepo.findOne({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Trader profile not found');
    }

    return this.toProfileDto(profile);
  }

  /* ──── Start copying a trader ────────────────────── */
  async startCopying(
    copierId: string,
    traderId: string,
    allocation: string,
  ): Promise<CopyRelationshipDto> {
    if (copierId === traderId) {
      throw new BadRequestException('You cannot copy yourself');
    }

    const allocationDec = new Decimal(allocation);
    if (allocationDec.lte(0)) {
      throw new BadRequestException('Allocation must be positive');
    }

    // Verify trader exists
    const traderProfile = await this.profileRepo.findOne({
      where: { userId: traderId, isPublic: true },
    });
    if (!traderProfile) {
      throw new NotFoundException('Trader not found or profile is private');
    }

    // Check for existing active copy
    const existing = await this.copyRepo.findOne({
      where: { copierId, traderId, status: 'active' },
    });
    if (existing) {
      throw new BadRequestException('You are already copying this trader');
    }

    // Lock allocation funds (USDT)
    await this.walletsService.lockFunds(copierId, 'USDT', allocationDec);

    const copy = this.copyRepo.create({
      copierId,
      traderId,
      allocationAmount: allocationDec.toFixed(),
      maxPositionSize: allocationDec.div(5).toFixed(), // default 20% per position
      status: 'active',
      totalCopiedTrades: 0,
      totalPnl: '0',
    });

    const saved = await this.copyRepo.save(copy);

    // Increment copier count on trader profile
    traderProfile.totalCopiers += 1;
    await this.profileRepo.save(traderProfile);

    this.logger.log(
      `User ${copierId} started copying trader ${traderId} with allocation ${allocation}`,
    );

    return this.toCopyDto(saved, traderProfile.displayName);
  }

  /* ──── Stop copying a trader ─────────────────────── */
  async stopCopying(copierId: string, traderId: string): Promise<{ message: string }> {
    const copy = await this.copyRepo.findOne({
      where: { copierId, traderId },
    });

    if (!copy || copy.status === 'stopped') {
      throw new NotFoundException('Active copy relationship not found');
    }

    // Unlock remaining allocation
    const remainingAllocation = new Decimal(copy.allocationAmount);
    if (remainingAllocation.gt(0)) {
      await this.walletsService.unlockFunds(copierId, 'USDT', remainingAllocation);
    }

    copy.status = 'stopped';
    await this.copyRepo.save(copy);

    // Decrement copier count
    const traderProfile = await this.profileRepo.findOne({
      where: { userId: traderId },
    });
    if (traderProfile && traderProfile.totalCopiers > 0) {
      traderProfile.totalCopiers -= 1;
      await this.profileRepo.save(traderProfile);
    }

    this.logger.log(`User ${copierId} stopped copying trader ${traderId}`);

    return { message: 'Copy relationship stopped' };
  }

  /* ──── Pause copying ─────────────────────────────── */
  async pauseCopying(copierId: string, traderId: string): Promise<{ message: string }> {
    const copy = await this.copyRepo.findOne({
      where: { copierId, traderId, status: 'active' },
    });

    if (!copy) {
      throw new NotFoundException('Active copy relationship not found');
    }

    copy.status = 'paused';
    await this.copyRepo.save(copy);

    this.logger.log(`User ${copierId} paused copying trader ${traderId}`);

    return { message: 'Copy relationship paused' };
  }

  /* ──── Resume copying ────────────────────────────── */
  async resumeCopying(copierId: string, traderId: string): Promise<{ message: string }> {
    const copy = await this.copyRepo.findOne({
      where: { copierId, traderId, status: 'paused' },
    });

    if (!copy) {
      throw new NotFoundException('Paused copy relationship not found');
    }

    copy.status = 'active';
    await this.copyRepo.save(copy);

    this.logger.log(`User ${copierId} resumed copying trader ${traderId}`);

    return { message: 'Copy relationship resumed' };
  }

  /* ──── Get user's active copies ──────────────────── */
  async getMyCopies(copierId: string): Promise<CopyRelationshipDto[]> {
    const copies = await this.copyRepo.find({
      where: { copierId },
      order: { createdAt: 'DESC' },
    });

    const results: CopyRelationshipDto[] = [];
    for (const copy of copies) {
      const profile = await this.profileRepo.findOne({
        where: { userId: copy.traderId },
      });
      results.push(this.toCopyDto(copy, profile?.displayName ?? 'Unknown'));
    }

    return results;
  }

  /* ──── Propagate trader's order to all copiers ───── */
  async onTraderOrderPlaced(
    traderId: string,
    order: { symbol: string; side: 'buy' | 'sell'; type: 'limit' | 'market'; price: string; quantity: string },
  ): Promise<void> {
    const activeCopies = await this.copyRepo.find({
      where: { traderId, status: 'active' },
    });

    if (activeCopies.length === 0) return;

    const traderProfile = await this.profileRepo.findOne({
      where: { userId: traderId },
    });

    for (const copy of activeCopies) {
      try {
        const allocation = new Decimal(copy.allocationAmount);
        const maxPos = new Decimal(copy.maxPositionSize);
        const orderValue = new Decimal(order.price).mul(order.quantity);

        // Scale position proportionally, capped by maxPositionSize
        const scaledValue = Decimal.min(
          orderValue.mul(allocation).div(1000), // proportional scaling
          maxPos,
        );

        const scaledQuantity = scaledValue.div(order.price);

        if (scaledQuantity.lte(0)) continue;

        await this.tradingService.placeOrder(copy.copierId, {
          symbol: order.symbol,
          side: order.side,
          type: order.type,
          price: order.price,
          quantity: scaledQuantity.toFixed(8),
        });

        copy.totalCopiedTrades += 1;
        await this.copyRepo.save(copy);

        this.logger.log(
          `Copied order for user ${copy.copierId}: ${order.side} ${scaledQuantity.toFixed(8)} ${order.symbol}`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to copy trade for user ${copy.copierId}: ${(err as Error).message}`,
        );
      }
    }
  }

  /* ──── Map to DTOs ───────────────────────────────── */
  private toProfileDto(p: TraderProfile): TraderProfileDto {
    return {
      id: p.id,
      userId: p.userId,
      displayName: p.displayName,
      bio: p.bio,
      totalFollowers: p.totalFollowers,
      totalCopiers: p.totalCopiers,
      winRate: p.winRate,
      totalPnl: p.totalPnl,
      avgReturnPercent: p.avgReturnPercent,
      isPublic: p.isPublic,
      createdAt: p.createdAt.toISOString(),
    };
  }

  private toCopyDto(c: CopyRelationship, traderName: string): CopyRelationshipDto {
    return {
      id: c.id,
      copierId: c.copierId,
      traderId: c.traderId,
      traderDisplayName: traderName,
      allocationAmount: c.allocationAmount,
      maxPositionSize: c.maxPositionSize,
      status: c.status,
      totalCopiedTrades: c.totalCopiedTrades,
      totalPnl: c.totalPnl,
      createdAt: c.createdAt.toISOString(),
    };
  }
}
