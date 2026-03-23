import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReferralsService } from './referrals.service';

interface AuthenticatedRequest {
  user: { id: string; email: string; role: string };
}

@ApiTags('referrals')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('code')
  @ApiOperation({ summary: 'Get or create my referral code' })
  @ApiResponse({ status: 200, description: 'Referral code returned' })
  async getCode(@Req() req: AuthenticatedRequest) {
    const code = await this.referralsService.getReferralCode(req.user.id);
    return { code };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get my referral statistics' })
  @ApiResponse({ status: 200, description: 'Referral statistics' })
  async getStats(@Req() req: AuthenticatedRequest) {
    return this.referralsService.getReferralStats(req.user.id);
  }

  @Get('list')
  @ApiOperation({ summary: 'List my referrals' })
  @ApiResponse({ status: 200, description: 'List of referrals' })
  async listReferrals(@Req() req: AuthenticatedRequest) {
    const referrals = await this.referralsService.getUserReferrals(req.user.id);
    return { referrals };
  }

  @Post('apply')
  @ApiOperation({ summary: 'Apply a referral code (for new users)' })
  @ApiResponse({ status: 201, description: 'Referral applied successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or already applied code' })
  @ApiResponse({ status: 404, description: 'Referral code not found' })
  async applyReferral(
    @Req() req: AuthenticatedRequest,
    @Body('code') code: string,
  ) {
    const referral = await this.referralsService.applyReferral(
      req.user.id,
      code,
    );
    return { success: true, referral };
  }
}
