import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { KycTierGuard, RequireKycTier } from '../../common/guards/kyc-tier.guard';
import { AccountStatusGuard } from '../../common/guards/account-status.guard';
import { AdminRoleGuard, RequireAdmin } from '../../common/guards/admin-role.guard';
import { TwoFactorGuard, Require2FA } from '../../common/guards/two-factor.guard';
import { AdminIpGuard } from '../../common/guards/admin-ip.guard';
import { FundingService } from './funding.service';

interface AuthReq { user: { id: string; email: string; role: string } }

@ApiTags('funding')
@Controller()
export class FundingController {
  constructor(private readonly funding: FundingService) {}

  /* ─── User: Deposits ───────────────────────────────── */

  @Post('deposit-address')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get or create a deposit address' })
  async getDepositAddress(
    @Req() req: AuthReq,
    @Body() dto: { asset: string; network: string },
  ) {
    return this.funding.getOrCreateDepositAddress(req.user.id, dto.asset, dto.network);
  }

  @Get('deposits')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List user deposits' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async getUserDeposits(
    @Req() req: AuthReq,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.funding.getUserDeposits(req.user.id, limit ?? 20, offset ?? 0);
  }

  /* ─── User: Withdrawals ────────────────────────────── */

  @Post('withdrawals')
  @UseGuards(JwtAuthGuard, AccountStatusGuard, KycTierGuard, TwoFactorGuard)
  @RequireKycTier(1)
  @Require2FA()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Request a withdrawal (KYC + 2FA required)' })
  @ApiResponse({ status: 403, description: '2FA code required or invalid' })
  async requestWithdrawal(
    @Req() req: AuthReq,
    @Body() dto: {
      asset: string;
      network: string;
      address: string;
      memo?: string;
      amount: string;
      twoFactorCode?: string;
    },
  ) {
    return this.funding.requestWithdrawal(req.user.id, dto);
  }

  @Get('withdrawals')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List user withdrawals' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async getUserWithdrawals(
    @Req() req: AuthReq,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.funding.getUserWithdrawals(req.user.id, limit ?? 20, offset ?? 0);
  }

  /* ═══ Admin: Withdrawal Review ═════════════════════════
   * All admin endpoints require:
   *   1. JwtAuthGuard — valid token
   *   2. AdminRoleGuard — user.role === 'admin'
   * Plus service-level checks:
   *   3. Self-approval prohibition
   *   4. Maker-checker on process (different admin from approver)
   * ═════════════════════════════════════════════════════ */

  @Get('admin/withdrawals/pending')
  @UseGuards(JwtAuthGuard, AdminIpGuard, AdminRoleGuard)
  @RequireAdmin()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List pending withdrawals (admin only)' })
  async getPendingWithdrawals() {
    return this.funding.getPendingWithdrawals();
  }

  @Post('admin/withdrawals/:id/approve')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @RequireAdmin()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Approve a withdrawal (admin only)' })
  @ApiResponse({ status: 403, description: 'Cannot approve own withdrawal' })
  async approveWithdrawal(
    @Req() req: AuthReq,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { note?: string },
  ) {
    return this.funding.approveWithdrawal(id, req.user.id, dto.note);
  }

  @Post('admin/withdrawals/:id/reject')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @RequireAdmin()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Reject a withdrawal (admin only)' })
  async rejectWithdrawal(
    @Req() req: AuthReq,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { note: string },
  ) {
    return this.funding.rejectWithdrawal(id, req.user.id, dto.note);
  }

  @Post('admin/withdrawals/:id/process')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @RequireAdmin()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Execute a withdrawal (admin only, maker-checker enforced)' })
  @ApiResponse({ status: 403, description: 'Maker-checker: approver cannot process' })
  async processWithdrawal(
    @Req() req: AuthReq,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.funding.processWithdrawal(id, req.user.id);
  }

  @Post('admin/withdrawals/:id/recover')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @RequireAdmin()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Recover a failed withdrawal (admin only)' })
  async recoverFailedWithdrawal(
    @Req() req: AuthReq,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.funding.recoverFailedWithdrawal(id, req.user.id);
  }
}
