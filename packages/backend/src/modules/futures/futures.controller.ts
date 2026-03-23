import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  ParseUUIDPipe,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FuturesService, OpenPositionDto, AdjustLeverageDto, SetSlTpDto } from './futures.service';

interface AuthenticatedRequest {
  user: { id: string; email: string; role: string };
}

@ApiTags('futures')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('futures')
export class FuturesController {
  private readonly logger = new Logger(FuturesController.name);

  constructor(private readonly futuresService: FuturesService) {}

  @Get('contracts')
  @ApiOperation({ summary: 'List active perpetual futures contracts' })
  @ApiResponse({ status: 200, description: 'List of active contracts' })
  async getContracts() {
    return this.futuresService.getContracts();
  }

  @Post('positions')
  @ApiOperation({ summary: 'Open a new futures position' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['symbol', 'side', 'leverage', 'margin', 'entryPrice'],
      properties: {
        symbol: { type: 'string', example: 'BTCUSDT' },
        side: { type: 'string', enum: ['long', 'short'] },
        leverage: { type: 'number', example: 10 },
        margin: { type: 'string', example: '100' },
        entryPrice: { type: 'string', example: '65000' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Position opened successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or insufficient margin' })
  async openPosition(
    @Req() req: AuthenticatedRequest,
    @Body() dto: OpenPositionDto,
  ) {
    return this.futuresService.openPosition(req.user.id, dto);
  }

  @Delete('positions/:id')
  @ApiOperation({ summary: 'Close an open futures position' })
  @ApiResponse({ status: 200, description: 'Position closed, PnL settled' })
  @ApiResponse({ status: 404, description: 'Position not found' })
  async closePosition(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.futuresService.closePosition(req.user.id, id);
  }

  @Patch('positions/:id/leverage')
  @ApiOperation({ summary: 'Adjust leverage on an open position' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['leverage'],
      properties: {
        leverage: { type: 'number', example: 20 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Leverage adjusted' })
  @ApiResponse({ status: 404, description: 'Position not found' })
  async adjustLeverage(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustLeverageDto,
  ) {
    return this.futuresService.adjustLeverage(req.user.id, id, dto.leverage);
  }

  @Patch('positions/:id/sl-tp')
  @ApiOperation({ summary: 'Set stop loss and/or take profit on a position' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        stopLoss: { type: 'string', nullable: true, example: '60000' },
        takeProfit: { type: 'string', nullable: true, example: '70000' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'SL/TP updated' })
  @ApiResponse({ status: 404, description: 'Position not found' })
  async setSlTp(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetSlTpDto,
  ) {
    let position;
    if (dto.stopLoss !== undefined) {
      position = await this.futuresService.setStopLoss(req.user.id, id, dto.stopLoss ?? null);
    }
    if (dto.takeProfit !== undefined) {
      position = await this.futuresService.setTakeProfit(req.user.id, id, dto.takeProfit ?? null);
    }
    if (!position) {
      // If neither was provided, just return the position
      return this.futuresService.getPositions(req.user.id).then(
        (positions) => positions.find((p) => p.id === id) ?? null,
      );
    }
    return position;
  }

  @Get('positions')
  @ApiOperation({ summary: 'Get all futures positions for the authenticated user' })
  @ApiResponse({ status: 200, description: 'List of user positions' })
  async getPositions(@Req() req: AuthenticatedRequest) {
    return this.futuresService.getPositions(req.user.id);
  }
}
