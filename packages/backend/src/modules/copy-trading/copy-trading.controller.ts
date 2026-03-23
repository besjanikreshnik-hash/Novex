import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
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
  CopyTradingService,
  TraderProfileDto,
  CopyRelationshipDto,
} from './copy-trading.service';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; role: string };
}

@ApiTags('copy-trading')
@Controller('copy-trading')
export class CopyTradingController {
  constructor(private readonly copyTradingService: CopyTradingService) {}

  @Get('traders')
  @ApiOperation({ summary: 'Get top traders ranked by PnL' })
  @ApiResponse({ status: 200, description: 'List of top traders' })
  async getTopTraders(
    @Query('limit') limit?: string,
  ): Promise<TraderProfileDto[]> {
    return this.copyTradingService.getTopTraders(
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('traders/:id')
  @ApiOperation({ summary: 'Get trader profile by userId' })
  @ApiResponse({ status: 200, description: 'Trader profile' })
  async getTraderProfile(
    @Param('id') id: string,
  ): Promise<TraderProfileDto> {
    return this.copyTradingService.getTraderProfile(id);
  }

  @Post('copy')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Start copying a trader' })
  @ApiResponse({ status: 201, description: 'Copy relationship created' })
  async startCopying(
    @Req() req: AuthenticatedRequest,
    @Body() body: { traderId: string; allocation: string },
  ): Promise<CopyRelationshipDto> {
    return this.copyTradingService.startCopying(
      req.user.id,
      body.traderId,
      body.allocation,
    );
  }

  @Delete('copy/:traderId')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Stop copying a trader' })
  @ApiResponse({ status: 200, description: 'Copy relationship stopped' })
  async stopCopying(
    @Req() req: AuthenticatedRequest,
    @Param('traderId') traderId: string,
  ): Promise<{ message: string }> {
    return this.copyTradingService.stopCopying(req.user.id, traderId);
  }

  @Patch('copy/:traderId/pause')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Pause copying a trader' })
  @ApiResponse({ status: 200, description: 'Copy relationship paused' })
  async pauseCopying(
    @Req() req: AuthenticatedRequest,
    @Param('traderId') traderId: string,
  ): Promise<{ message: string }> {
    return this.copyTradingService.pauseCopying(req.user.id, traderId);
  }

  @Patch('copy/:traderId/resume')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Resume copying a trader' })
  @ApiResponse({ status: 200, description: 'Copy relationship resumed' })
  async resumeCopying(
    @Req() req: AuthenticatedRequest,
    @Param('traderId') traderId: string,
  ): Promise<{ message: string }> {
    return this.copyTradingService.resumeCopying(req.user.id, traderId);
  }

  @Get('my-copies')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get my active copy relationships' })
  @ApiResponse({ status: 200, description: 'List of copy relationships' })
  async getMyCopies(
    @Req() req: AuthenticatedRequest,
  ): Promise<CopyRelationshipDto[]> {
    return this.copyTradingService.getMyCopies(req.user.id);
  }
}
