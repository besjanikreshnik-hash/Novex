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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AdminRoleGuard,
  RequireOps,
  RequireCompliance,
  RequireAdmin,
} from '../../common/guards/admin-role.guard';
import { GovernanceService } from './governance.service';
import { ChangeRequestType } from './entities/change-request.entity';

interface AuthReq { user: { id: string; role: string } }

@ApiTags('governance')
@ApiBearerAuth('access-token')
@Controller('admin/governance')
export class GovernanceController {
  constructor(private readonly governance: GovernanceService) {}

  /* ─── Trading Pair Controls ────────────────────────── */

  @Post('pair/halt')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @RequireOps()
  @ApiOperation({ summary: 'Propose halting a trading pair (requires OPS or higher)' })
  async proposePairHalt(
    @Req() req: AuthReq,
    @Body() dto: { symbol: string; reason: string },
  ) {
    return this.governance.propose(
      req.user.id,
      ChangeRequestType.PAIR_HALT,
      `Halt trading pair ${dto.symbol}: ${dto.reason}`,
      { symbol: dto.symbol },
    );
  }

  @Post('pair/unhalt')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @RequireOps()
  @ApiOperation({ summary: 'Propose unhalting a trading pair' })
  async proposePairUnhalt(
    @Req() req: AuthReq,
    @Body() dto: { symbol: string; reason: string },
  ) {
    return this.governance.propose(
      req.user.id,
      ChangeRequestType.PAIR_UNHALT,
      `Unhalt trading pair ${dto.symbol}: ${dto.reason}`,
      { symbol: dto.symbol },
    );
  }

  /* ─── Fee Changes ──────────────────────────────────── */

  @Post('fees/change')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @RequireOps()
  @ApiOperation({ summary: 'Propose fee configuration change' })
  async proposeFeeChange(
    @Req() req: AuthReq,
    @Body() dto: { symbol: string; makerFee?: string; takerFee?: string; reason: string },
  ) {
    return this.governance.propose(
      req.user.id,
      ChangeRequestType.FEE_CHANGE,
      `Change fees for ${dto.symbol}: ${dto.reason}`,
      { symbol: dto.symbol, makerFee: dto.makerFee, takerFee: dto.takerFee },
    );
  }

  /* ─── KYC Override ─────────────────────────────────── */

  @Post('kyc/override')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @RequireCompliance()
  @ApiOperation({ summary: 'Propose manual KYC status override (requires COMPLIANCE or higher)' })
  async proposeKycOverride(
    @Req() req: AuthReq,
    @Body() dto: { userId: string; newStatus: string; reason: string },
  ) {
    return this.governance.propose(
      req.user.id,
      ChangeRequestType.KYC_MANUAL_OVERRIDE,
      `KYC override for user ${dto.userId}: ${dto.reason}`,
      { userId: dto.userId, newStatus: dto.newStatus },
    );
  }

  /* ─── Approval / Rejection ─────────────────────────── */

  @Post('requests/:id/approve')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @RequireOps()
  @ApiOperation({ summary: 'Approve a change request (maker-checker: different admin)' })
  async approveRequest(
    @Req() req: AuthReq,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { note?: string },
  ) {
    return this.governance.approve(id, req.user.id, dto.note);
  }

  @Post('requests/:id/reject')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @RequireOps()
  @ApiOperation({ summary: 'Reject a change request' })
  async rejectRequest(
    @Req() req: AuthReq,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { note: string },
  ) {
    return this.governance.reject(id, req.user.id, dto.note);
  }

  @Post('requests/:id/emergency')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @RequireAdmin()
  @ApiOperation({ summary: 'Emergency execute (ADMIN only, bypasses maker-checker, requires post-review)' })
  async emergencyExecute(
    @Req() req: AuthReq,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { justification: string },
  ) {
    return this.governance.emergencyExecute(id, req.user.id, dto.justification);
  }

  /* ─── Queries ──────────────────────────────────────── */

  @Get('requests/pending')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @RequireOps()
  @ApiOperation({ summary: 'List pending change requests' })
  async listPending() {
    return this.governance.listPending();
  }

  @Get('requests')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @RequireOps()
  @ApiOperation({ summary: 'List all change requests' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async listAll(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.governance.listAll(limit ?? 50, offset ?? 0);
  }

  @Get('requests/:id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @RequireOps()
  @ApiOperation({ summary: 'Get change request details' })
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.governance.getById(id);
  }
}
