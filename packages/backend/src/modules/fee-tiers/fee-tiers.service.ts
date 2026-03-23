import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { FeeTier } from './fee-tier.entity';
import { Trade } from '../trading/entities/trade.entity';

export interface FeeTierDto {
  id: string;
  tier: number;
  name: string;
  minVolume30d: string;
  makerFeeRate: string;
  takerFeeRate: string;
  benefits: Record<string, any>;
}

export interface UserTierDto {
  tier: number;
  name: string;
  volume30d: string;
  makerFeeRate: string;
  takerFeeRate: string;
  nextTier: { name: string; minVolume30d: string; volumeNeeded: string } | null;
}

export interface EffectiveFeesDto {
  makerFee: string;
  takerFee: string;
  tier: number;
}

@Injectable()
export class FeeTiersService {
  private readonly logger = new Logger(FeeTiersService.name);

  constructor(
    @InjectRepository(FeeTier)
    private readonly feeTierRepo: Repository<FeeTier>,
    @InjectRepository(Trade)
    private readonly tradeRepo: Repository<Trade>,
  ) {}

  /* ──── List all fee tiers ────────────────────────── */
  async getFeeTiers(): Promise<FeeTierDto[]> {
    const tiers = await this.feeTierRepo.find({ order: { tier: 'ASC' } });
    return tiers.map((t) => ({
      id: t.id,
      tier: t.tier,
      name: t.name,
      minVolume30d: t.minVolume30d,
      makerFeeRate: t.makerFeeRate,
      takerFeeRate: t.takerFeeRate,
      benefits: t.benefits,
    }));
  }

  /* ──── Calculate user's 30-day trading volume ───── */
  private async getVolume30d(userId: string): Promise<Decimal> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await this.tradeRepo
      .createQueryBuilder('trade')
      .select('COALESCE(SUM(trade.gross_quote), 0)', 'totalVolume')
      .where(
        '(trade.maker_user_id = :userId OR trade.taker_user_id = :userId)',
        { userId },
      )
      .andWhere('trade.created_at >= :since', { since: thirtyDaysAgo })
      .getRawOne();

    return new Decimal(result?.totalVolume || '0');
  }

  /* ──── Determine user's tier ────────────────────── */
  async getUserTier(userId: string): Promise<UserTierDto> {
    const volume30d = await this.getVolume30d(userId);
    const tiers = await this.feeTierRepo.find({ order: { tier: 'DESC' } });

    let matched = tiers[tiers.length - 1]; // default: lowest tier
    for (const t of tiers) {
      if (volume30d.gte(t.minVolume30d)) {
        matched = t;
        break;
      }
    }

    // Find next tier
    const allTiersAsc = await this.feeTierRepo.find({ order: { tier: 'ASC' } });
    const nextTierEntity = allTiersAsc.find((t) => t.tier > matched.tier);
    const nextTier = nextTierEntity
      ? {
          name: nextTierEntity.name,
          minVolume30d: nextTierEntity.minVolume30d,
          volumeNeeded: new Decimal(nextTierEntity.minVolume30d)
            .minus(volume30d)
            .clampedTo(0, Infinity)
            .toFixed(),
        }
      : null;

    return {
      tier: matched.tier,
      name: matched.name,
      volume30d: volume30d.toFixed(),
      makerFeeRate: matched.makerFeeRate,
      takerFeeRate: matched.takerFeeRate,
      nextTier,
    };
  }

  /* ──── Get effective fees for a user ────────────── */
  async getEffectiveFees(userId: string): Promise<EffectiveFeesDto> {
    const userTier = await this.getUserTier(userId);
    return {
      makerFee: userTier.makerFeeRate,
      takerFee: userTier.takerFeeRate,
      tier: userTier.tier,
    };
  }
}
