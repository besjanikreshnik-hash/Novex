import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsersService } from '../../modules/users/users.service';
import { KycStatus } from '../../modules/users/user.entity';

/**
 * KYC tier requirements:
 *   0 = NONE     → view-only, no trading or funding
 *   1 = VERIFIED → standard limits ($10K/day deposit, $5K/day withdrawal)
 *   2 = ENHANCED → higher limits ($100K/day deposit, $50K/day withdrawal)
 */
export type KycTier = 0 | 1 | 2;

const KYC_TIER_KEY = 'requiredKycTier';

/** Decorator: require minimum KYC tier on a route */
export const RequireKycTier = (tier: KycTier) =>
  SetMetadata(KYC_TIER_KEY, tier);

/** Map KycStatus to numeric tier */
function statusToTier(status: KycStatus): KycTier {
  switch (status) {
    case KycStatus.VERIFIED: return 1;
    // Enhanced would be tier 2 — not yet in the KycStatus enum
    default: return 0;
  }
}

@Injectable()
export class KycTierGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredTier = this.reflector.getAllAndOverride<KycTier>(
      KYC_TIER_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredTier === undefined || requiredTier === 0) {
      return true; // no KYC requirement
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    if (!userId) {
      throw new ForbiddenException('Authentication required');
    }

    const user = await this.users.findById(userId);
    if (!user) {
      throw new ForbiddenException('User not found');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is suspended');
    }

    const userTier = statusToTier(user.kycStatus);
    if (userTier < requiredTier) {
      throw new ForbiddenException(
        `KYC verification required. Current level: ${user.kycStatus}. ` +
        `Please complete identity verification to access this feature.`,
      );
    }

    return true;
  }
}
