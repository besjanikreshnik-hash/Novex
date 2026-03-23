import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import Decimal from 'decimal.js';
import { Withdrawal, WithdrawalStatus } from '../../modules/funding/entities/withdrawal.entity';
import { UsersService } from '../../modules/users/users.service';
import { KycStatus } from '../../modules/users/user.entity';

/**
 * Enforces daily withdrawal limits based on KYC tier.
 *
 * Tier 0 (unverified): $0 (blocked)
 * Tier 1 (verified):   $5,000/day
 * Tier 2 (enhanced):   $50,000/day
 */
const DAILY_LIMITS: Record<string, number> = {
  [KycStatus.NONE]: 0,
  [KycStatus.PENDING]: 0,
  [KycStatus.VERIFIED]: 5000,
  [KycStatus.REJECTED]: 0,
};

@Injectable()
export class WithdrawalLimitsGuard implements CanActivate {
  constructor(
    @InjectRepository(Withdrawal)
    private readonly withdrawalRepo: Repository<Withdrawal>,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const body = request.body;

    if (!userId || !body?.amount) return true;

    const user = await this.users.findById(userId);
    if (!user) throw new ForbiddenException('User not found');

    const dailyLimit = DAILY_LIMITS[user.kycStatus] ?? 0;
    if (dailyLimit === 0) {
      throw new ForbiddenException(
        'Withdrawals require KYC verification. Please complete identity verification.',
      );
    }

    // Sum withdrawals in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentWithdrawals = await this.withdrawalRepo.find({
      where: {
        userId,
        createdAt: MoreThan(oneDayAgo),
      },
    });

    // Sum amounts (crude USD equivalent — in production, use price oracle)
    const totalToday = recentWithdrawals.reduce(
      (sum, w) => sum.plus(w.amount),
      new Decimal(0),
    );

    const requested = new Decimal(body.amount);
    if (totalToday.plus(requested).gt(dailyLimit)) {
      throw new ForbiddenException(
        `Daily withdrawal limit exceeded. Limit: $${dailyLimit}, ` +
        `Used today: ${totalToday.toFixed(2)}, Requested: ${requested.toFixed(2)}. ` +
        `Upgrade your KYC tier for higher limits.`,
      );
    }

    return true;
  }
}
