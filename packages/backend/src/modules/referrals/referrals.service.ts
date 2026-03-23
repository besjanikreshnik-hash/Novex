import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Referral, ReferralStatus } from './referral.entity';
import { ReferralCode } from './referral-code.entity';

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    @InjectRepository(Referral)
    private readonly referralRepo: Repository<Referral>,
    @InjectRepository(ReferralCode)
    private readonly codeRepo: Repository<ReferralCode>,
  ) {}

  /**
   * Generate a unique 8-character alphanumeric referral code.
   */
  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Generate a unique referral code for a user, retrying on collision.
   */
  async generateReferralCode(userId: string): Promise<ReferralCode> {
    // Check if user already has a code
    const existing = await this.codeRepo.findOne({ where: { userId } });
    if (existing) return existing;

    // Try up to 5 times to avoid code collisions
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = this.generateCode();
      try {
        const entry = this.codeRepo.create({ userId, code });
        const saved = await this.codeRepo.save(entry);
        this.logger.debug(`Referral code generated for user ${userId}: ${code}`);
        return saved;
      } catch (err: unknown) {
        const pgError = err as { code?: string };
        // Unique constraint violation — retry with a new code
        if (pgError.code === '23505') continue;
        throw err;
      }
    }

    throw new BadRequestException('Failed to generate a unique referral code. Please try again.');
  }

  /**
   * Get (or create) the referral code for a user.
   */
  async getReferralCode(userId: string): Promise<string> {
    const entry = await this.codeRepo.findOne({ where: { userId } });
    if (entry) return entry.code;

    const created = await this.generateReferralCode(userId);
    return created.code;
  }

  /**
   * Apply a referral code for a new user.
   */
  async applyReferral(newUserId: string, code: string): Promise<Referral> {
    // Find the referral code
    const codeEntry = await this.codeRepo.findOne({ where: { code } });
    if (!codeEntry) {
      throw new NotFoundException('Invalid referral code');
    }

    // Cannot refer yourself
    if (codeEntry.userId === newUserId) {
      throw new BadRequestException('You cannot use your own referral code');
    }

    // Check if this user has already been referred
    const existingReferral = await this.referralRepo.findOne({
      where: { referredId: newUserId },
    });
    if (existingReferral) {
      throw new BadRequestException('A referral code has already been applied to this account');
    }

    const referral = this.referralRepo.create({
      referrerId: codeEntry.userId,
      referredId: newUserId,
      referralCode: code,
      status: ReferralStatus.PENDING,
      rewardAmount: '0',
      rewardCurrency: 'USDT',
    });

    const saved = await this.referralRepo.save(referral);
    this.logger.debug(`Referral applied: ${code} — referrer=${codeEntry.userId}, referred=${newUserId}`);
    return saved;
  }

  /**
   * Get all referrals made by a user.
   */
  async getUserReferrals(
    userId: string,
  ): Promise<Referral[]> {
    return this.referralRepo.find({
      where: { referrerId: userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get referral statistics for a user.
   */
  async getReferralStats(userId: string): Promise<{
    totalReferrals: number;
    activeReferrals: number;
    rewardedReferrals: number;
    totalRewards: string;
    rewardCurrency: string;
  }> {
    const referrals = await this.referralRepo.find({
      where: { referrerId: userId },
    });

    const totalReferrals = referrals.length;
    const activeReferrals = referrals.filter(
      (r) => r.status === ReferralStatus.ACTIVE || r.status === ReferralStatus.REWARDED,
    ).length;
    const rewardedReferrals = referrals.filter(
      (r) => r.status === ReferralStatus.REWARDED,
    ).length;

    const totalRewards = referrals
      .reduce((sum, r) => sum + parseFloat(r.rewardAmount || '0'), 0)
      .toFixed(8);

    return {
      totalReferrals,
      activeReferrals,
      rewardedReferrals,
      totalRewards,
      rewardCurrency: 'USDT',
    };
  }
}
