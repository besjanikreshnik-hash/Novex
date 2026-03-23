import {
  Controller,
  Get,
  Post,
  Body,
  Param,
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
  StakingService,
  StakingProductDto,
  StakingPositionDto,
} from './staking.service';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; role: string };
}

@ApiTags('staking')
@Controller('staking')
export class StakingController {
  constructor(private readonly stakingService: StakingService) {}

  @Get('products')
  @ApiOperation({ summary: 'List active staking products' })
  @ApiResponse({ status: 200, description: 'List of active staking products' })
  async getProducts(): Promise<StakingProductDto[]> {
    return this.stakingService.getProducts();
  }

  @Post('stake')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Stake funds into a staking product' })
  @ApiResponse({ status: 201, description: 'Staking position created' })
  async stake(
    @Req() req: AuthenticatedRequest,
    @Body() body: { productId: string; amount: string },
  ): Promise<StakingPositionDto> {
    return this.stakingService.stake(
      req.user.id,
      body.productId,
      body.amount,
    );
  }

  @Post('unstake/:positionId')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Unstake a position and claim rewards' })
  @ApiResponse({ status: 200, description: 'Position unstaked successfully' })
  async unstake(
    @Req() req: AuthenticatedRequest,
    @Param('positionId') positionId: string,
  ): Promise<StakingPositionDto> {
    return this.stakingService.unstake(req.user.id, positionId);
  }

  @Get('positions')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List user staking positions' })
  @ApiResponse({ status: 200, description: 'List of user staking positions' })
  async getPositions(
    @Req() req: AuthenticatedRequest,
  ): Promise<StakingPositionDto[]> {
    return this.stakingService.getUserPositions(req.user.id);
  }
}
