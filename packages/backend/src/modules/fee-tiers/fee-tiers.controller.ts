import {
  Controller,
  Get,
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
import {
  FeeTiersService,
  FeeTierDto,
  UserTierDto,
} from './fee-tiers.service';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; role: string };
}

@ApiTags('fee-tiers')
@Controller('fee-tiers')
export class FeeTiersController {
  constructor(private readonly feeTiersService: FeeTiersService) {}

  @Get()
  @ApiOperation({ summary: 'List all fee tiers (public)' })
  @ApiResponse({ status: 200, description: 'List of all fee tiers' })
  async getFeeTiers(): Promise<FeeTierDto[]> {
    return this.feeTiersService.getFeeTiers();
  }

  @Get('my')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get my current tier, volume, and fees' })
  @ApiResponse({ status: 200, description: 'Current user tier info' })
  async getMyTier(@Req() req: AuthenticatedRequest): Promise<UserTierDto> {
    return this.feeTiersService.getUserTier(req.user.id);
  }
}
