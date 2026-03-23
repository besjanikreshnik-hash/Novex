import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { StakingProduct } from './staking-product.entity';
import { StakingPosition } from './staking-position.entity';
import { WalletsService } from '../wallets/wallets.service';

export interface StakingProductDto {
  id: string;
  asset: string;
  name: string;
  annualRate: string;
  minAmount: string;
  maxAmount: string;
  lockDays: number;
  totalStaked: string;
  maxCapacity: string;
  status: string;
}

export interface StakingPositionDto {
  id: string;
  productId: string;
  asset: string;
  productName: string;
  amount: string;
  annualRate: string;
  startDate: string;
  endDate: string | null;
  lockDays: number;
  status: string;
  earnedReward: string;
  currentReward: string;
  createdAt: string;
}

@Injectable()
export class StakingService {
  private readonly logger = new Logger(StakingService.name);

  constructor(
    @InjectRepository(StakingProduct)
    private readonly productRepo: Repository<StakingProduct>,
    @InjectRepository(StakingPosition)
    private readonly positionRepo: Repository<StakingPosition>,
    private readonly walletsService: WalletsService,
  ) {}

  /* ──── List active staking products ─────────────────── */
  async getProducts(): Promise<StakingProductDto[]> {
    const products = await this.productRepo.find({
      where: { status: 'active' },
      order: { createdAt: 'ASC' },
    });

    return products.map((p) => ({
      id: p.id,
      asset: p.asset,
      name: p.name,
      annualRate: p.annualRate,
      minAmount: p.minAmount,
      maxAmount: p.maxAmount,
      lockDays: p.lockDays,
      totalStaked: p.totalStaked,
      maxCapacity: p.maxCapacity,
      status: p.status,
    }));
  }

  /* ──── Stake funds ──────────────────────────────────── */
  async stake(
    userId: string,
    productId: string,
    amount: string,
  ): Promise<StakingPositionDto> {
    const product = await this.productRepo.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Staking product not found');
    }

    if (product.status !== 'active') {
      throw new BadRequestException('This staking product is not active');
    }

    const stakeAmount = new Decimal(amount);

    if (stakeAmount.lte(0)) {
      throw new BadRequestException('Amount must be positive');
    }

    const minAmount = new Decimal(product.minAmount);
    if (stakeAmount.lt(minAmount)) {
      throw new BadRequestException(
        `Minimum stake amount is ${minAmount.toFixed()} ${product.asset}`,
      );
    }

    const maxAmount = new Decimal(product.maxAmount);
    if (maxAmount.gt(0) && stakeAmount.gt(maxAmount)) {
      throw new BadRequestException(
        `Maximum stake amount is ${maxAmount.toFixed()} ${product.asset}`,
      );
    }

    // Check capacity
    const maxCapacity = new Decimal(product.maxCapacity);
    const totalStaked = new Decimal(product.totalStaked);
    if (maxCapacity.gt(0) && totalStaked.plus(stakeAmount).gt(maxCapacity)) {
      throw new BadRequestException('Product capacity exceeded');
    }

    // Lock funds in user's wallet
    await this.walletsService.lockFunds(
      userId,
      product.asset,
      stakeAmount,
    );

    // Calculate end date
    const startDate = new Date();
    let endDate: Date | null = null;
    if (product.lockDays > 0) {
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + product.lockDays);
    }

    // Create position
    const position = this.positionRepo.create({
      userId,
      productId: product.id,
      amount: stakeAmount.toFixed(),
      startDate,
      endDate,
      status: 'active',
      earnedReward: '0',
      lastRewardAt: startDate,
    });

    const saved = await this.positionRepo.save(position);

    // Update total staked on product
    product.totalStaked = totalStaked.plus(stakeAmount).toFixed();
    await this.productRepo.save(product);

    this.logger.log(
      `User ${userId} staked ${stakeAmount.toFixed()} ${product.asset} in product ${product.name}`,
    );

    return this.toPositionDto(saved, product);
  }

  /* ──── Unstake funds ────────────────────────────────── */
  async unstake(
    userId: string,
    positionId: string,
  ): Promise<StakingPositionDto> {
    const position = await this.positionRepo.findOne({
      where: { id: positionId, userId },
      relations: ['product'],
    });

    if (!position) {
      throw new NotFoundException('Staking position not found');
    }

    if (position.status !== 'active') {
      throw new BadRequestException('Position is not active');
    }

    // Check lock period
    if (position.endDate && new Date() < position.endDate) {
      const remaining = Math.ceil(
        (position.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      throw new BadRequestException(
        `Lock period not yet expired. ${remaining} day(s) remaining.`,
      );
    }

    // Calculate final rewards
    const currentReward = this.calculateRewards(position);
    const totalReward = new Decimal(position.earnedReward).plus(currentReward);
    const stakeAmount = new Decimal(position.amount);

    // Unlock original staked funds (moves from locked -> available)
    await this.walletsService.unlockFunds(
      userId,
      position.product.asset,
      stakeAmount,
    );

    // Credit earned rewards by getting wallet and adding to available
    // Rewards are newly minted yield, not previously locked funds
    if (totalReward.gt(0)) {
      const wallet = await this.walletsService.getOrCreate(
        userId,
        position.product.asset,
      );
      wallet.available = new Decimal(wallet.available)
        .plus(totalReward)
        .toFixed();
      // getOrCreate returns a managed entity; save goes through TypeORM
      await this.productRepo.manager.save(wallet);
    }

    // Update position
    position.earnedReward = totalReward.toFixed();
    position.status = 'completed';
    position.lastRewardAt = new Date();
    await this.positionRepo.save(position);

    // Update total staked on product
    const product = position.product;
    product.totalStaked = new Decimal(product.totalStaked)
      .minus(stakeAmount)
      .toFixed();
    await this.productRepo.save(product);

    this.logger.log(
      `User ${userId} unstaked ${stakeAmount.toFixed()} ${product.asset} with reward ${totalReward.toFixed()}`,
    );

    return this.toPositionDto(position, product);
  }

  /* ──── Calculate pending rewards (daily compounding) ─ */
  calculateRewards(position: StakingPosition): Decimal {
    if (position.status !== 'active') return new Decimal(0);

    const now = new Date();
    const lastReward = position.lastRewardAt
      ? new Date(position.lastRewardAt)
      : new Date(position.startDate);

    const daysDiff =
      (now.getTime() - lastReward.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff <= 0) return new Decimal(0);

    const principal = new Decimal(position.amount);
    const annualRate = new Decimal(
      (position as any).product?.annualRate ?? '0',
    );

    if (annualRate.lte(0)) return new Decimal(0);

    // Daily compounding: A = P * (1 + r/365)^days - P
    const dailyRate = annualRate.div(100).div(365);
    const compounded = principal.mul(
      dailyRate.plus(1).pow(Math.floor(daysDiff)),
    );
    const reward = compounded.minus(principal);

    return reward.gt(0) ? reward : new Decimal(0);
  }

  /* ──── Get user positions ───────────────────────────── */
  async getUserPositions(userId: string): Promise<StakingPositionDto[]> {
    const positions = await this.positionRepo.find({
      where: { userId },
      relations: ['product'],
      order: { createdAt: 'DESC' },
    });

    return positions.map((p) => this.toPositionDto(p, p.product));
  }

  /* ──── Map to DTO ───────────────────────────────────── */
  private toPositionDto(
    position: StakingPosition,
    product: StakingProduct,
  ): StakingPositionDto {
    const currentReward = this.calculateRewards(position);
    const totalReward = new Decimal(position.earnedReward).plus(currentReward);

    return {
      id: position.id,
      productId: product.id,
      asset: product.asset,
      productName: product.name,
      amount: position.amount,
      annualRate: product.annualRate,
      startDate: position.startDate.toISOString(),
      endDate: position.endDate ? position.endDate.toISOString() : null,
      lockDays: product.lockDays,
      status: position.status,
      earnedReward: position.earnedReward,
      currentReward: totalReward.toFixed(18),
      createdAt: position.createdAt.toISOString(),
    };
  }
}
