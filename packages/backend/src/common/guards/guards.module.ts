import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KycTierGuard } from './kyc-tier.guard';
import { AccountStatusGuard } from './account-status.guard';
import { WithdrawalLimitsGuard } from './withdrawal-limits.guard';
import { AdminRoleGuard } from './admin-role.guard';
import { TwoFactorGuard } from './two-factor.guard';
import { AdminIpGuard } from './admin-ip.guard';
import { Withdrawal } from '../../modules/funding/entities/withdrawal.entity';
import { UsersModule } from '../../modules/users/users.module';

@Global()
@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([Withdrawal]),
  ],
  providers: [KycTierGuard, AccountStatusGuard, WithdrawalLimitsGuard, AdminRoleGuard, TwoFactorGuard, AdminIpGuard],
  exports: [KycTierGuard, AccountStatusGuard, WithdrawalLimitsGuard, AdminRoleGuard, TwoFactorGuard, AdminIpGuard],
})
export class GuardsModule {}
